import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { createCyrillicPdf, autoTable } from "@/lib/server-pdf";
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

  const doc = createCyrillicPdf();

  // Header
  doc.setFontSize(20);
  doc.text("ArtPix 3D Purchase Order", 14, 20);

  doc.setFontSize(10);
  doc.text(`PO Number: ${po.poNumber}`, 14, 30);
  doc.text(`Vendor: ${po.vendor.name}`, 14, 35);
  doc.text(`Status: ${formatPoStatus(po.status)}`, 14, 40);
  doc.text(`Order Date: ${po.orderDate.toISOString().slice(0, 10)}`, 14, 45);
  doc.text(`Expected Date: ${po.expectedDate?.toISOString().slice(0, 10) ?? "-"}`, 14, 50);
  doc.text(`Created By: ${po.createdBy.name ?? "-"}`, 14, 55);
  doc.text(`Vendor Order ID: ${po.vendorOrderId ?? "-"}`, 14, 60);
  doc.text(`Payment Terms: ${po.vendor.paymentTerms ?? "-"}`, 14, 65);

  // Items Table
  autoTable(doc, {
    startY: 75,
    head: [["ID", "Product", "Qty", "Unit Cost", "Total"]],
    body: po.items.map((item) => [
      item.product.compoundId,
      item.product.name,
      item.orderedQty,
      item.unitCost.toString(),
      item.totalCost.toString(),
    ]),
    styles: { font: "Roboto" },
    headStyles: { fillColor: [51, 65, 85] },
  });

  // Footer / Totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ${po.subtotal.toString()}`, 140, finalY);
  doc.text(`Shipping: ${po.shippingCost.toString()}`, 140, finalY + 5);
  doc.text(`Other Costs: ${po.otherCosts.toString()}`, 140, finalY + 10);
  doc.setFontSize(12);
  doc.setFont("Roboto", "normal"); // Bold would be better if we had it
  doc.text(`Total: ${po.totalCost.toString()}`, 140, finalY + 18);

  if (po.constraintWarnings.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text("Constraint Warnings:", 14, finalY + 30);
    po.constraintWarnings.forEach((warning, i) => {
      doc.text(`• ${warning}`, 14, finalY + 35 + i * 5);
    });
  }

  const pdfArrayBuffer = doc.output("arraybuffer");

  return new NextResponse(pdfArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${po.poNumber}.pdf"`,
    },
  });
}
