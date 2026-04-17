import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { LabelsClient } from "@/components/labels/LabelsClient";

export default async function LabelsPage() {
  noStore();

  const [products, locations, pallets] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { compoundId: "asc" },
      select: { id: true, compoundId: true, name: true },
      take: 100,
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, qrCode: true },
    }),
    prisma.pallet.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, palletNumber: true, status: true },
      take: 20,
    }),
  ]);

  return <LabelsClient products={products} locations={locations.map((location) => ({ ...location, qrCode: location.qrCode ?? `LOC-${location.id.slice(0, 8).toUpperCase()}` }))} pallets={pallets} />;
}
