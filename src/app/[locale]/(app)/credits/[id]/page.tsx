import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { VendorCreditDetailClient } from "@/components/vendor-credits/VendorCreditDetailClient";

export default async function CreditDetailPage({ params }: { params: { locale: string; id: string } }) {
  noStore();

  const credit = await prisma.vendorCredit.findUnique({
    where: { id: params.id },
    include: {
      vendor: { select: { name: true } },
      purchaseOrder: { select: { poNumber: true } },
      items: {
        include: {
          product: { select: { compoundId: true, name: true } },
        },
      },
    },
  });

  if (!credit) {
    notFound();
  }

  return (
    <VendorCreditDetailClient
      locale={params.locale}
      credit={{
        id: credit.id,
        creditNumber: credit.creditNumber,
        vendorName: credit.vendor.name,
        poNumber: credit.purchaseOrder?.poNumber ?? "-",
        reason: credit.reason,
        status: credit.status,
        totalAmount: credit.totalAmount.toString(),
        notes: credit.notes ?? "",
        items: credit.items.map((item) => ({
          id: item.id,
          productLabel: `${item.product.compoundId} — ${item.product.name}`,
          quantity: item.quantity,
          unitCost: item.unitCost.toString(),
          totalCredit: item.totalCredit.toString(),
          notes: item.notes ?? "",
        })),
      }}
    />
  );
}
