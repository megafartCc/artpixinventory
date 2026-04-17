import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManagePurchaseOrders } from "@/lib/permissions";
import { purchaseOrderMutationSchema } from "@/lib/purchase-order-schemas";
import {
  mapPurchaseOrderWriteData,
  nextPoNumber,
  preparePurchaseOrderWrite,
} from "@/lib/purchase-order-server";

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManagePurchaseOrders(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = purchaseOrderMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid PO payload." },
      { status: 400 }
    );
  }

  try {
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const payload = parsed.data;
      const prepared = await preparePurchaseOrderWrite(tx, payload);
      const poNumber = await nextPoNumber(tx);

      return tx.purchaseOrder.create({
        data: {
          poNumber,
          ...mapPurchaseOrderWriteData({
            payload,
            userId: session.user.id,
            status: payload.submitForApproval ? "PENDING_APPROVAL" : "DRAFT",
            templateId: prepared.template?.id ?? null,
            orderDate: prepared.orderDate,
            expectedDate: prepared.expectedDate,
            calculation: prepared.calculation,
          }),
          items: {
            create: prepared.calculation.lineItems.map((item) => ({
              productId: item.productId,
              orderedQty: item.orderedQty,
              unitCost: toDecimal(item.unitCost),
              totalCost: toDecimal(item.totalCost),
              notes: item.notes,
            })),
          },
        },
        select: { id: true, poNumber: true },
      });
    });

    return NextResponse.json(
      {
        data: purchaseOrder,
        message: parsed.data.submitForApproval
          ? "Purchase order submitted for approval."
          : "Purchase order saved as draft.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/purchase-orders failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create purchase order.",
      },
      { status: 500 }
    );
  }
}
