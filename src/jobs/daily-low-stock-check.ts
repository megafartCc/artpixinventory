import prisma from "@/lib/prisma";
import { sendSlackNotification } from "@/lib/slack";

export async function runDailyLowStockCheck() {
  const levels = await prisma.stockLevel.findMany({
    where: { product: { active: true } },
    include: {
      product: { select: { id: true, compoundId: true, minStock: true } },
      location: { select: { name: true } },
    },
  });

  const low = levels.filter((level) => level.quantity <= level.product.minStock);

  for (const row of low.slice(0, 20)) {
    await sendSlackNotification({
      type: "LOW_STOCK",
      channel: "#inventory-alerts",
      message: `Low stock: ${row.product.compoundId} at ${row.location.name} is ${row.quantity} (min ${row.product.minStock}).`,
      entityType: "Product",
      entityId: row.product.id,
    });
  }

  return { checked: levels.length, low: low.length };
}
