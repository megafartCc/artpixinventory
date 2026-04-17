import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManagePurchaseOrders } from "@/lib/permissions";
import { nextPoNumber } from "@/lib/purchase-order-server";

type RouteContext = {
  params: {
    id: string;
  };
};

function toDecimal(value: string) {
  return new Prisma.Decimal(value);
}

export async function POST(_: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManagePurchaseOrders(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const source = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      items: true,
    },
  });

  if (!source) {
    return NextResponse.json(
      { error: "Purchase order not found." },
      { status: 404 }
    );
  }

  const duplicated = await prisma.$transaction(async (tx) => {
    const poNumber = await nextPoNumber(tx);
    const duplicate = await tx.purchaseOrder.create({
      data: {
        poNumber,
        vendorId: source.vendorId,
        vendorOrderId: null,
        status: "DRAFT",
        orderDate: new Date(),
        expectedDate: source.expectedDate,
        containerTemplateId: source.containerTemplateId,
        subtotal: source.subtotal,
        shippingCost: source.shippingCost,
        otherCosts: source.otherCosts,
        totalCost: source.totalCost,
        totalWeightKg: source.totalWeightKg,
        totalPallets: source.totalPallets,
        totalLooseBoxes: source.totalLooseBoxes,
        constraintWarnings: source.constraintWarnings,
        duplicatedFromId: source.id,
        notes: source.notes,
        createdById: session.user.id,
        items: {
          create: source.items.map((item) => ({
            productId: item.productId,
            orderedQty: item.orderedQty,
            unitCost: toDecimal(item.unitCost.toString()),
            totalCost: toDecimal(item.totalCost.toString()),
            notes: item.notes,
          })),
        },
      },
      select: { id: true, poNumber: true },
    });

    return duplicate;
  });

  return NextResponse.json({
    data: duplicated,
    message: "Purchase order duplicated as draft.",
  });
}
