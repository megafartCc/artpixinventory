import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { buildSimplePdf } from "@/lib/simple-pdf";
import { formatPoStatus } from "@/lib/purchase-order-utils";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      vendor: {
        select: { name: true, country: true, paymentTerms: true },
      },
      createdBy: {
        select: { name: true },
      },
      items: {
        include: {
          product: {
            select: {
              compoundId: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!po) {
    return NextResponse.json(
      { error: "Purchase order not found." },
      { status: 404 }
    );
  }

  const lines = [
    "ArtPix 3D Purchase Order",
    "",
    `PO Number: ${po.poNumber}`,
    `Vendor: ${po.vendor.name}`,
    `Status: ${formatPoStatus(po.status)}`,
    `Order Date: ${po.orderDate.toISOString().slice(0, 10)}`,
    `Expected Date: ${po.expectedDate?.toISOString().slice(0, 10) ?? "-"}`,
    `Created By: ${po.createdBy.name ?? "-"}`,
    `Vendor Order ID: ${po.vendorOrderId ?? "-"}`,
    `Payment Terms: ${po.vendor.paymentTerms ?? "-"}`,
    "",
    "Line Items",
    ...po.items.map(
      (item) =>
        `${item.product.compoundId} ${item.product.name} | Qty ${item.orderedQty} | Unit ${item.unitCost.toString()} | Total ${item.totalCost.toString()}`
    ),
    "",
    `Subtotal: ${po.subtotal.toString()}`,
    `Shipping: ${po.shippingCost.toString()}`,
    `Other Costs: ${po.otherCosts.toString()}`,
    `Total: ${po.totalCost.toString()}`,
  ];

  if (po.constraintWarnings.length > 0) {
    lines.push("", "Constraint Warnings", ...po.constraintWarnings);
  }

  const pdf = buildSimplePdf(lines);

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${po.poNumber}.pdf"`,
    },
  });
}
