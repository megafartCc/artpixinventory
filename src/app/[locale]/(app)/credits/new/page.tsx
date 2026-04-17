import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { VendorCreditFormClient } from "@/components/vendor-credits/VendorCreditFormClient";

export default async function NewCreditPage({ params }: { params: { locale: string } }) {
  noStore();

  const [vendors, products, purchaseOrders] = await Promise.all([
    prisma.vendor.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, select: { id: true, compoundId: true, name: true }, orderBy: { compoundId: "asc" }, take: 400 }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"] } },
      select: { id: true, poNumber: true, vendorId: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  return <VendorCreditFormClient locale={params.locale} vendors={vendors} products={products} purchaseOrders={purchaseOrders} />;
}
