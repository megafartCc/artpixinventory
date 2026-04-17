import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { PalletPlacementClient } from "@/components/receiving/PalletPlacementClient";

export default async function PalletPlacementPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const [pallets, locations] = await Promise.all([
    prisma.pallet.findMany({
      where: {
        status: { in: ["OPEN", "READY"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              select: {
                compoundId: true,
                name: true,
              },
            },
          },
        },
      },
    }),
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
  ]);

  return (
    <PalletPlacementClient
      locale={params.locale}
      pallets={pallets.map((pallet) => ({
        id: pallet.id,
        palletNumber: pallet.palletNumber,
        status: pallet.status,
        items: pallet.items.map((item) => ({
          compoundId: item.product.compoundId,
          productName: item.product.name,
          quantity: item.quantity,
        })),
      }))}
      locations={locations.map((location) => ({
        id: location.id,
        name: location.name,
        qrCode: location.qrCode ?? "",
        type: location.type,
      }))}
    />
  );
}
