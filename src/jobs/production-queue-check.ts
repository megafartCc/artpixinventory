import prisma from "@/lib/prisma";
import { sendSlackNotification } from "@/lib/slack";

export async function runProductionQueueCheck() {
  const machines = await prisma.machine.findMany({
    where: { active: true },
    select: { id: true, name: true, locationId: true },
    take: 20,
  });

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, compoundId: true },
    take: 20,
  });

  if (machines.length === 0 || products.length === 0) {
    return { generated: 0, insufficient: 0 };
  }

  const placeholderNeeds = machines.map((machine, index) => {
    const product = products[index % products.length];
    const quantityNeeded = 10 + ((index * 7) % 45);
    return {
      machine,
      product,
      quantityNeeded,
    };
  });

  let insufficient = 0;
  const now = new Date();

  for (const need of placeholderNeeds) {
    const stock = await prisma.stockLevel.findUnique({
      where: {
        productId_locationId: {
          productId: need.product.id,
          locationId: need.machine.locationId,
        },
      },
      select: { quantity: true },
    });

    const quantityInStock = stock?.quantity ?? 0;
    const sufficient = quantityInStock >= need.quantityNeeded;

    const created = await prisma.productionQueueItem.create({
      data: {
        machineId: need.machine.id,
        productId: need.product.id,
        quantityNeeded: need.quantityNeeded,
        quantityInStock,
        sufficient,
        erpixSyncedAt: now,
        notificationSent: !sufficient,
      },
    });

    if (!sufficient) {
      insufficient += 1;
      await sendSlackNotification({
        type: "PRODUCTION_RESTOCK_NEEDED",
        channel: "#warehouse-ops",
        message: `🔧 ${need.machine.name} needs ${need.quantityNeeded}× ${need.product.compoundId}, sublocation has ${quantityInStock}.`,
        entityType: "ProductionQueueItem",
        entityId: created.id,
      });
    }
  }

  return {
    generated: placeholderNeeds.length,
    insufficient,
    syncedAt: now.toISOString(),
  };
}
