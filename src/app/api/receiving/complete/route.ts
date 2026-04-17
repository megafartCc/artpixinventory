import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageReceiving } from "@/lib/permissions";
import { receivingCompleteSchema } from "@/lib/receiving-schemas";
import {
  adjustStockLevel,
  createActivityLog,
  getProductTotalStock,
} from "@/lib/inventory-utils";

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageReceiving(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = receivingCompleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid receiving payload." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  avgCost: true,
                },
              },
            },
          },
        },
      });

      if (!purchaseOrder) {
        throw new Error("Purchase order not found.");
      }

      if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status)) {
        throw new Error("Only ordered purchase orders can be received.");
      }

      const receivingSetting = await tx.setting.findUnique({
        where: { key: "default_receiving_location" },
        select: { value: true },
      });

      if (!receivingSetting?.value) {
        throw new Error("Default receiving location is not configured.");
      }

      const receivingLocation = await tx.location.findUnique({
        where: { id: receivingSetting.value },
        select: { id: true, name: true },
      });

      if (!receivingLocation) {
        throw new Error("Default receiving location was not found.");
      }

      const itemInputMap = new Map(
        parsed.data.items.map((item) => [item.poItemId, item])
      );

      const activeItems = purchaseOrder.items
        .map((poItem) => {
          const input = itemInputMap.get(poItem.id);
          if (!input || input.receiveQty <= 0) {
            return null;
          }
          return { poItem, input };
        })
        .filter(Boolean) as Array<{
        poItem: (typeof purchaseOrder.items)[number];
        input: (typeof parsed.data.items)[number];
      }>;

      if (activeItems.length === 0) {
        throw new Error("Enter at least one receive quantity greater than zero.");
      }

      for (const entry of activeItems) {
        const remaining = entry.poItem.orderedQty - entry.poItem.receivedQty;
        if (entry.input.receiveQty > remaining) {
          throw new Error(`Receive quantity exceeds remaining quantity for ${entry.poItem.productId}.`);
        }
        if (entry.input.damagedQty > entry.input.receiveQty) {
          throw new Error("Damaged quantity cannot exceed received quantity.");
        }
      }

      const receivingSession = await tx.receivingSession.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          locationId: receivingLocation.id,
          receivedById: session.user.id,
          status: "COMPLETED",
          notes: parsed.data.notes,
          completedAt: new Date(),
        },
      });

      let damagedTotal = 0;

      for (const entry of activeItems) {
        await tx.receivingItem.create({
          data: {
            receivingSessionId: receivingSession.id,
            poItemId: entry.poItem.id,
            productId: entry.poItem.productId,
            receivedQty: entry.input.receiveQty,
            damagedQty: entry.input.damagedQty,
            notes: entry.input.notes,
          },
        });

        await tx.pOItem.update({
          where: { id: entry.poItem.id },
          data: {
            receivedQty: entry.poItem.receivedQty + entry.input.receiveQty,
          },
        });

        const lineShare =
          Number(purchaseOrder.subtotal) > 0
            ? Number(entry.poItem.totalCost) / Number(purchaseOrder.subtotal)
            : 0;
        const extrasPerUnit =
          entry.poItem.orderedQty > 0
            ? ((Number(purchaseOrder.shippingCost) + Number(purchaseOrder.otherCosts)) *
                lineShare) /
              entry.poItem.orderedQty
            : 0;
        const landedUnitCost = Number(entry.poItem.unitCost) + extrasPerUnit;

        const currentStockQty = await getProductTotalStock(tx, entry.poItem.productId);
        const currentAvg = Number(entry.poItem.product.avgCost);
        const newTotalQty = currentStockQty + entry.input.receiveQty;
        const newAvgCost =
          newTotalQty > 0
            ? (currentStockQty * currentAvg +
                entry.input.receiveQty * landedUnitCost) /
              newTotalQty
            : landedUnitCost;

        await tx.product.update({
          where: { id: entry.poItem.productId },
          data: { avgCost: toDecimal(newAvgCost) },
        });

        const stockResult = await adjustStockLevel(tx, {
          productId: entry.poItem.productId,
          locationId: receivingLocation.id,
          delta: entry.input.receiveQty,
        });

        await createActivityLog(tx, {
          action: "PO_RECEIVED",
          entityType: "ReceivingSession",
          entityId: receivingSession.id,
          userId: session.user.id,
          details: {
            purchaseOrderId: purchaseOrder.id,
            poItemId: entry.poItem.id,
            productId: entry.poItem.productId,
            locationId: receivingLocation.id,
            receivedQty: entry.input.receiveQty,
            damagedQty: entry.input.damagedQty,
            beforeQty: stockResult.previousQty,
            afterQty: stockResult.nextQty,
          } as Prisma.InputJsonValue,
        });

        damagedTotal += entry.input.damagedQty;
      }

      const refreshedItems = await tx.pOItem.findMany({
        where: { purchaseOrderId: purchaseOrder.id },
        select: {
          orderedQty: true,
          receivedQty: true,
        },
      });

      const fullyReceived = refreshedItems.every(
        (item) => item.receivedQty >= item.orderedQty
      );

      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
        },
      });

      return {
        receivingSessionId: receivingSession.id,
        status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
        damagedTotal,
      };
    });

    return NextResponse.json({
      data: result,
      message:
        result.damagedTotal > 0
          ? `${result.damagedTotal} damaged items received - move them to Quarantine next.`
          : "Receiving completed.",
    });
  } catch (error) {
    console.error("POST /api/receiving/complete failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to complete receiving.",
      },
      { status: 500 }
    );
  }
}
