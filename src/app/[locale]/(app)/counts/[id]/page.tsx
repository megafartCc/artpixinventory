import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canPerformCounts, canReviewCounts } from "@/lib/permissions";
import { CountSessionClient } from "@/components/counts/CountSessionClient";

export default async function CountSessionPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    notFound();
  }

  const countSession = await prisma.countSession.findUnique({
    where: { id: params.id },
    include: {
      location: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      entries: {
        include: {
          product: { select: { id: true, compoundId: true, name: true } },
          countedBy: { select: { name: true } },
        },
        orderBy: { scannedAt: "desc" },
      },
    },
  });

  if (!countSession) {
    notFound();
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { compoundId: "asc" },
    select: { id: true, compoundId: true, name: true, barcode: true },
  });

  return (
    <CountSessionClient
      locale={params.locale}
      currentUserId={session.user.id}
      canCount={canPerformCounts(session.user.role)}
      canReview={canReviewCounts(session.user.role)}
      session={{
        id: countSession.id,
        name: countSession.name,
        locationId: countSession.locationId,
        locationName: countSession.location.name,
        type: countSession.type,
        status: countSession.status,
        notes: countSession.notes,
        assignedToId: countSession.assignedToId,
        assignedToName: countSession.assignedTo?.name ?? null,
      }}
      products={products}
      entries={countSession.entries.map((entry) => ({
        id: entry.id,
        productId: entry.productId,
        compoundId: entry.product.compoundId,
        productName: entry.product.name,
        countedQty: entry.countedQty,
        variance: entry.variance,
        scannedAt: entry.scannedAt.toISOString(),
        notes: entry.notes,
        countedByName: entry.countedBy.name,
      }))}
    />
  );
}
