import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { ContainerTemplatesClient } from "@/components/container-templates/ContainerTemplatesClient";

export default async function ContainerTemplatesPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const templates = await prisma.containerTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { vendors: true, purchaseOrders: true },
      },
    },
  });

  return (
    <ContainerTemplatesClient
      locale={params.locale}
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        maxWeightKg: template.maxWeightKg.toString(),
        maxPallets: template.maxPallets,
        maxLooseBoxes: template.maxLooseBoxes,
        description: template.description,
        active: template.active,
        vendorCount: template._count.vendors,
        purchaseOrderCount: template._count.purchaseOrders,
      }))}
    />
  );
}
