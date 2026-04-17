import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { IndexesManager } from "@/components/indexes/IndexesManager";

export default async function IndexesPage() {
  noStore();

  const indexes = await prisma.productIndex.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return (
    <IndexesManager
      initialIndexes={indexes.map((index) => ({
        id: index.id,
        name: index.name,
        description: index.description,
        active: index.active,
        productCount: index._count.products,
      }))}
    />
  );
}
