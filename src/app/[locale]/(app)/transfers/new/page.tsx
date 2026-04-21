import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { TransferWorkflowClient } from "@/components/transfers/TransferWorkflowClient";

export default async function NewTransferPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { transfer?: string; source?: string; product?: string };
}) {
  noStore();

  const [locations, stockLevels, transfer] = await Promise.all([
    prisma.location.findMany({
      where: {
        active: true,
        qrCode: { not: null },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        qrCode: true,
        type: true,
      },
    }),
    prisma.stockLevel.findMany({
      where: {
        quantity: { gt: 0 },
        location: { active: true },
        product: { active: true },
      },
      orderBy: [{ location: { name: "asc" } }, { product: { compoundId: "asc" } }],
      include: {
        location: {
          select: { id: true, name: true, qrCode: true },
        },
        product: {
          select: { id: true, compoundId: true, name: true },
        },
      },
    }),
    searchParams.transfer
      ? prisma.transfer.findUnique({
          where: { id: searchParams.transfer },
          include: {
            picks: {
              orderBy: { pickedAt: "asc" },
              include: {
                product: {
                  select: { id: true, compoundId: true, name: true },
                },
                fromLocation: {
                  select: { id: true, name: true, qrCode: true },
                },
              },
            },
            drops: {
              orderBy: { droppedAt: "asc" },
              include: {
                product: {
                  select: { id: true, compoundId: true, name: true },
                },
                toLocation: {
                  select: { id: true, name: true, qrCode: true },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <TransferWorkflowClient
      locale={params.locale}
      initialSourceQr={searchParams.source}
      initialSelectedProductId={searchParams.product}
      currentTransfer={
        transfer
          ? {
              id: transfer.id,
              reference: transfer.reference,
              status: transfer.status,
              picks: transfer.picks.map((pick) => ({
                id: pick.id,
                productId: pick.productId,
                compoundId: pick.product.compoundId,
                productName: pick.product.name,
                locationId: pick.fromLocationId,
                locationName: pick.fromLocation.name,
                quantity: pick.quantity,
              })),
              drops: transfer.drops.map((drop) => ({
                id: drop.id,
                productId: drop.productId,
                compoundId: drop.product.compoundId,
                productName: drop.product.name,
                locationId: drop.toLocationId,
                locationName: drop.toLocation.name,
                quantity: drop.quantity,
              })),
            }
          : null
      }
      locations={locations.map((location) => ({
        id: location.id,
        name: location.name,
        qrCode: location.qrCode ?? "",
        type: location.type,
      }))}
      stockLevels={stockLevels.map((stock) => ({
        locationId: stock.locationId,
        locationName: stock.location.name,
        locationQrCode: stock.location.qrCode ?? "",
        productId: stock.productId,
        compoundId: stock.product.compoundId,
        productName: stock.product.name,
        quantity: stock.quantity,
      }))}
    />
  );
}
