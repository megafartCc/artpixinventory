import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReviewCounts } from "@/lib/permissions";
import { CountReviewClient } from "@/components/counts/CountReviewClient";

export default async function CountReviewPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user || !canReviewCounts(session.user.role)) {
    notFound();
  }

  const countSession = await prisma.countSession.findUnique({
    where: { id: params.id },
    include: {
      location: { select: { name: true } },
      entries: {
        include: {
          product: { select: { compoundId: true, name: true } },
        },
        orderBy: [{ variance: "desc" }, { scannedAt: "desc" }],
      },
    },
  });

  if (!countSession) {
    notFound();
  }

  return (
    <CountReviewClient
      locale={params.locale}
      countSessionId={countSession.id}
      countName={countSession.name}
      locationName={countSession.location.name}
      entries={countSession.entries.map((entry) => ({
        id: entry.id,
        compoundId: entry.product.compoundId,
        productName: entry.product.name,
        expectedQty: entry.expectedQty,
        countedQty: entry.countedQty,
        variance: entry.variance,
        notes: entry.notes,
      }))}
    />
  );
}
