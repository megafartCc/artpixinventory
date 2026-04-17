import prisma from "@/lib/prisma";
import { sendSlackNotification } from "@/lib/slack";

export async function runDailyPoAgingCheck() {
  const overdue = await prisma.purchaseOrder.findMany({
    where: {
      expectedDate: { not: null, lt: new Date() },
      status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
    },
    include: { vendor: { select: { name: true } } },
    take: 20,
  });

  for (const po of overdue) {
    await sendSlackNotification({
      type: "PO_OVERDUE",
      channel: "#purchasing",
      message: `PO overdue: ${po.poNumber} (${po.vendor.name}) expected ${po.expectedDate?.toISOString().slice(0, 10)}.`,
      entityType: "PurchaseOrder",
      entityId: po.id,
    });
  }

  return { overdue: overdue.length };
}
