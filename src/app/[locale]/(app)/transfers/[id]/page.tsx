import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { TransferDetailClient } from "@/components/transfers/TransferDetailClient";

export default async function TransferDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const transfer = await prisma.transfer.findUnique({
    where: { id: params.id },
    include: {
      createdBy: {
        select: { name: true },
      },
      picks: {
        orderBy: { pickedAt: "asc" },
        include: {
          product: {
            select: { compoundId: true, name: true },
          },
          fromLocation: {
            select: { name: true },
          },
        },
      },
      drops: {
        orderBy: { droppedAt: "asc" },
        include: {
          product: {
            select: { compoundId: true, name: true },
          },
          toLocation: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!transfer) {
    notFound();
  }

  return (
    <TransferDetailClient
      locale={params.locale}
      transfer={{
        id: transfer.id,
        reference: transfer.reference,
        status: transfer.status,
        createdBy: transfer.createdBy.name,
        startedAt: transfer.startedAt.toISOString().slice(0, 16).replace("T", " "),
        completedAt:
          transfer.completedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "-",
        picks: transfer.picks.map((pick) => ({
          id: pick.id,
          compoundId: pick.product.compoundId,
          productName: pick.product.name,
          locationName: pick.fromLocation.name,
          quantity: pick.quantity,
          timestamp: pick.pickedAt.toISOString().slice(0, 16).replace("T", " "),
        })),
        drops: transfer.drops.map((drop) => ({
          id: drop.id,
          compoundId: drop.product.compoundId,
          productName: drop.product.name,
          locationName: drop.toLocation.name,
          quantity: drop.quantity,
          timestamp: drop.droppedAt.toISOString().slice(0, 16).replace("T", " "),
        })),
      }}
    />
  );
}
