import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { ProductsClient } from "@/components/products/ProductsClient";

export default async function ProductsPage({ params }: { params: { locale: string } }) {
  noStore();

  const [products, indexes] = await Promise.all([
    prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        index: { select: { id: true, name: true } },
        categories: {
          select: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.productIndex.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <ProductsClient
      locale={params.locale}
      initialProducts={products.map((product) => ({
        id: product.id,
        compoundId: product.compoundId,
        name: product.name,
        indexId: product.index.id,
        indexName: product.index.name,
        categories: product.categories.map((entry) => entry.category.name),
        uom: product.uom,
        minStock: product.minStock,
        avgCost: product.avgCost.toString(),
        active: product.active,
        barcode: product.barcode,
        length: product.length?.toString() ?? "",
        width: product.width?.toString() ?? "",
        height: product.height?.toString() ?? "",
        notes: product.notes ?? "",
        dimensionUnit: product.dimensionUnit ?? "in",
        updatedAt: product.updatedAt.toISOString(),
      }))}
      indexes={indexes}
    />
  );
}
