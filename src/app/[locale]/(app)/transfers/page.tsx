import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { TransfersClient } from "@/components/transfers/TransfersClient";

export default async function TransfersPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const transfers = await prisma.transfer.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      createdBy: {
        select: { name: true },
      },
      picks: {
        select: { id: true },
      },
    },
  });

  return (
    <TransfersClient
      locale={params.locale}
      transfers={transfers.map((transfer) => ({
        id: transfer.id,
        reference: transfer.reference,
        status: transfer.status,
        createdBy: transfer.createdBy.name,
        startedAt: transfer.startedAt.toISOString().slice(0, 16).replace("T", " "),
        completedAt:
          transfer.completedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "-",
        itemsCount: transfer.picks.length,
      }))}
    />
  );
}
