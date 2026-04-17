import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { CategoriesManager } from "@/components/categories/CategoriesManager";

export default async function CategoriesPage() {
  noStore();

  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { products: true, children: true },
      },
    },
  });

  return (
    <CategoriesManager
      initialCategories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        parentId: category.parentId,
        active: category.active,
        productCount: category._count.products,
        childCount: category._count.children,
      }))}
    />
  );
}
