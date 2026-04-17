import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManagePurchaseOrders } from "@/lib/permissions";
import { purchaseOrderMutationSchema } from "@/lib/purchase-order-schemas";
import {
  mapPurchaseOrderWriteData,
  preparePurchaseOrderWrite,
} from "@/lib/purchase-order-server";

type RouteContext = {
  params: {
    id: string;
  };
};

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

export async function PATCH(request: Request, { params }: RouteContext) {
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
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          poNumber: true,
          createdById: true,
          status: true,
        },
      });

      if (!existing) {
        throw new Error("Purchase order not found.");
      }

      if (!["DRAFT", "PENDING_APPROVAL"].includes(existing.status)) {
        throw new Error("Only draft or pending POs can be edited.");
      }

      const payload = parsed.data;
      const prepared = await preparePurchaseOrderWrite(tx, payload);

      await tx.pOItem.deleteMany({
        where: { purchaseOrderId: params.id },
      });

      return tx.purchaseOrder.update({
        where: { id: params.id },
        data: {
          ...mapPurchaseOrderWriteData({
            payload,
            userId: existing.createdById,
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
          approvedById: null,
          approvedAt: null,
        },
        select: { id: true, poNumber: true },
      });
    });

    return NextResponse.json({
      data: updated,
      message: parsed.data.submitForApproval
        ? "Purchase order updated and submitted."
        : "Purchase order updated.",
    });
  } catch (error) {
    console.error("PATCH /api/purchase-orders/[id] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update purchase order.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManagePurchaseOrders(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
    },
  });

  if (!po) {
    return NextResponse.json(
      { error: "Purchase order not found." },
      { status: 404 }
    );
  }

  if (po.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only draft purchase orders can be deleted." },
      { status: 409 }
    );
  }

  await prisma.purchaseOrder.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ message: "Purchase order deleted." });
}
