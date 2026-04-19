import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { ProductFormClient } from "@/components/products/ProductFormClient";

export default async function NewProductPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const indexes = await prisma.productIndex.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <ProductFormClient locale={params.locale} mode="create" indexes={indexes} />;
}
