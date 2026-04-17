import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { VendorCreditsClient } from "@/components/vendor-credits/VendorCreditsClient";

export default async function CreditsPage({ params }: { params: { locale: string } }) {
  noStore();

  const credits = await prisma.vendorCredit.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { name: true } },
      purchaseOrder: { select: { poNumber: true } },
    },
  });

  return (
    <VendorCreditsClient
      locale={params.locale}
      credits={credits.map((credit) => ({
        id: credit.id,
        creditNumber: credit.creditNumber,
        vendorName: credit.vendor.name,
        poNumber: credit.purchaseOrder?.poNumber ?? "-",
        reason: credit.reason,
        totalAmount: credit.totalAmount.toString(),
        status: credit.status,
        createdAt: credit.createdAt.toISOString().slice(0, 10),
      }))}
    />
  );
}
