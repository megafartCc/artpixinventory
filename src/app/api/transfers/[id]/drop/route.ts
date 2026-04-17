import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageTransfers } from "@/lib/permissions";
import { transferDropSchema } from "@/lib/transfer-schemas";
import { adjustStockLevel, createActivityLog } from "@/lib/inventory-utils";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageTransfers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = transferDropSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid drop payload." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: params.id },
        select: { id: true, status: true, reference: true },
      });

      if (!transfer) {
        throw new Error("Transfer not found.");
      }

      if (transfer.status !== "DROPPING") {
        throw new Error("Transfer is not in drop-off mode.");
      }

      const destination = await tx.location.findFirst({
        where: { qrCode: parsed.data.locationQrCode, active: true },
        select: { id: true, name: true },
      });

      if (!destination) {
        throw new Error("Destination location QR was not found.");
      }

      const [picks, drops] = await Promise.all([
        tx.transferPick.findMany({
          where: { transferId: transfer.id, productId: parsed.data.productId },
          select: { quantity: true },
        }),
        tx.transferDrop.findMany({
          where: { transferId: transfer.id, productId: parsed.data.productId },
          select: { quantity: true },
        }),
      ]);

      const pickedTotal = picks.reduce((sum, item) => sum + item.quantity, 0);
      const droppedTotal = drops.reduce((sum, item) => sum + item.quantity, 0);
      const remaining = pickedTotal - droppedTotal;

      if (parsed.data.quantity > remaining) {
        throw new Error("Drop quantity exceeds the picked quantity remaining.");
      }

      const stockResult = await adjustStockLevel(tx, {
        productId: parsed.data.productId,
        locationId: destination.id,
        delta: parsed.data.quantity,
      });

      const drop = await tx.transferDrop.create({
        data: {
          transferId: transfer.id,
          productId: parsed.data.productId,
          toLocationId: destination.id,
          quantity: parsed.data.quantity,
        },
      });

      await createActivityLog(tx, {
        action: "TRANSFER_DROPPED",
        entityType: "Transfer",
        entityId: transfer.id,
        userId: session.user.id,
        details: {
          transferReference: transfer.reference,
          productId: parsed.data.productId,
          toLocationId: destination.id,
          quantity: parsed.data.quantity,
          beforeQty: stockResult.previousQty,
          afterQty: stockResult.nextQty,
        } as Prisma.InputJsonValue,
      });

      const [allPicks, allDrops] = await Promise.all([
        tx.transferPick.groupBy({
          by: ["productId"],
          where: { transferId: transfer.id },
          _sum: { quantity: true },
        }),
        tx.transferDrop.groupBy({
          by: ["productId"],
          where: { transferId: transfer.id },
          _sum: { quantity: true },
        }),
      ]);

      const droppedByProduct = new Map(
        allDrops.map((item) => [item.productId, item._sum.quantity ?? 0])
      );
      const complete = allPicks.every(
        (item) => (item._sum.quantity ?? 0) === (droppedByProduct.get(item.productId) ?? 0)
      );

      if (complete && allPicks.length > 0) {
        await tx.transfer.update({
          where: { id: transfer.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }

      return { dropId: drop.id, complete, locationName: destination.name };
    });

    return NextResponse.json({
      data: result,
      message: result.complete
        ? "Drop complete. Transfer finished."
        : `Dropped stock at ${result.locationName}.`,
    });
  } catch (error) {
    console.error("POST /api/transfers/[id]/drop failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to drop transfer stock.",
      },
      { status: 500 }
    );
  }
}
