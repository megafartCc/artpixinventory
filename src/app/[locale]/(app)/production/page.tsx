import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { ProductionQueueClient } from "@/components/production/ProductionQueueClient";

export default async function ProductionPage() {
  noStore();

  const rows = await prisma.productionQueueItem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      machine: { select: { name: true } },
    },
    take: 150,
  });

  const productIds = Array.from(new Set(rows.map((row) => row.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, compoundId: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  const latest = rows[0]?.erpixSyncedAt ?? null;

  return (
    <ProductionQueueClient
      lastSynced={latest ? latest.toISOString().slice(0, 16).replace("T", " ") : "Never"}
      rows={rows.map((row) => ({
        id: row.id,
        machineName: row.machine.name,
        productName: productById.get(row.productId)?.name ?? row.productId,
        productCompoundId: productById.get(row.productId)?.compoundId ?? row.productId,
        quantityNeeded: row.quantityNeeded,
        quantityInStock: row.quantityInStock,
        sufficient: row.sufficient,
        syncedAt: row.erpixSyncedAt.toISOString(),
      }))}
    />
  );
}
