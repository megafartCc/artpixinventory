import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { PurchaseOrderDetailClient } from "@/components/purchase-orders/PurchaseOrderDetailClient";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      vendor: {
        select: {
          name: true,
          country: true,
        },
      },
      createdBy: {
        select: { name: true },
      },
      approvedBy: {
        select: { name: true },
      },
      items: {
        orderBy: { product: { compoundId: "asc" } },
        include: {
          product: {
            select: {
              compoundId: true,
              name: true,
            },
          },
        },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          label: true,
          fileName: true,
          fileUrl: true,
          uploadedAt: true,
        },
      },
      receivingSessions: {
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          receivedBy: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!purchaseOrder) {
    notFound();
  }

  const canCancel =
    ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED"].includes(
      purchaseOrder.status
    ) && purchaseOrder.items.every((item) => item.receivedQty === 0);

  return (
    <PurchaseOrderDetailClient
      locale={params.locale}
      purchaseOrder={{
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        vendorName: purchaseOrder.vendor.name,
        vendorCountry: purchaseOrder.vendor.country,
        vendorOrderId: purchaseOrder.vendorOrderId,
        status: purchaseOrder.status,
        orderDate: purchaseOrder.orderDate.toISOString().slice(0, 10),
        expectedDate: purchaseOrder.expectedDate?.toISOString().slice(0, 10) ?? null,
        subtotal: purchaseOrder.subtotal.toString(),
        shippingCost: purchaseOrder.shippingCost.toString(),
        otherCosts: purchaseOrder.otherCosts.toString(),
        totalCost: purchaseOrder.totalCost.toString(),
        totalWeightKg: purchaseOrder.totalWeightKg?.toString() ?? null,
        totalPallets: purchaseOrder.totalPallets,
        totalLooseBoxes: purchaseOrder.totalLooseBoxes,
        notes: purchaseOrder.notes,
        constraintWarnings: purchaseOrder.constraintWarnings,
        createdBy: purchaseOrder.createdBy.name,
        approvedBy: purchaseOrder.approvedBy?.name ?? null,
        approvedAt: purchaseOrder.approvedAt?.toISOString().slice(0, 10) ?? null,
        canCancel,
        items: purchaseOrder.items.map((item) => ({
          id: item.id,
          compoundId: item.product.compoundId,
          name: item.product.name,
          orderedQty: item.orderedQty,
          receivedQty: item.receivedQty,
          unitCost: item.unitCost.toString(),
          totalCost: item.totalCost.toString(),
          notes: item.notes,
        })),
        documents: purchaseOrder.documents.map((document) => ({
          id: document.id,
          label: document.label,
          fileName: document.fileName,
          fileUrl: document.fileUrl,
          uploadedAt: document.uploadedAt.toISOString().slice(0, 10),
        })),
        receivingSessions: purchaseOrder.receivingSessions.map((session) => ({
          id: session.id,
          status: session.status,
          startedAt: session.startedAt.toISOString().slice(0, 10),
          completedAt: session.completedAt?.toISOString().slice(0, 10) ?? null,
          receivedBy: session.receivedBy.name,
        })),
      }}
    />
  );
}
