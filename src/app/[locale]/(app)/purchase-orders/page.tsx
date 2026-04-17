import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { PurchaseOrdersClient } from "@/components/purchase-orders/PurchaseOrdersClient";

export default async function PurchaseOrdersPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vendor: {
        select: { name: true },
      },
      createdBy: {
        select: { name: true },
      },
    },
  });

  return (
    <PurchaseOrdersClient
      locale={params.locale}
      purchaseOrders={purchaseOrders.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendor.name,
        status: po.status,
        orderDate: po.orderDate.toISOString().slice(0, 10),
        expectedDate: po.expectedDate?.toISOString().slice(0, 10) ?? "-",
        totalCost: po.totalCost.toString(),
        createdBy: po.createdBy.name,
      }))}
    />
  );
}
