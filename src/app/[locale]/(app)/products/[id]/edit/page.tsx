import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { ProductFormClient } from "@/components/products/ProductFormClient";
import { productUnits } from "@/lib/product-schemas";

export default async function EditProductPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const [product, indexes] = await Promise.all([
    prisma.product.findUnique({
      where: { id: params.id },
      include: {
        categories: {
          include: { category: { select: { name: true } } },
        },
      },
    }),
    prisma.productIndex.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <ProductFormClient
      locale={params.locale}
      mode="edit"
      productId={product.id}
      indexes={indexes}
      initialValue={{
        compoundId: product.compoundId,
        name: product.name,
        indexId: product.indexId,
        uom: productUnits.includes(product.uom as (typeof productUnits)[number])
          ? (product.uom as (typeof productUnits)[number])
          : "pcs",
        barcode: product.barcode ?? "",
        minStock: String(product.minStock),
        notes: product.notes ?? "",
        active: product.active,
        categories: product.categories.map((entry) => entry.category.name),
        length: product.length?.toString() ?? "",
        width: product.width?.toString() ?? "",
        height: product.height?.toString() ?? "",
        weight: product.weight?.toString() ?? "",
        itemsPerBox: product.itemsPerBox?.toString() ?? "",
        boxesPerPallet: product.boxesPerPallet?.toString() ?? "",
        itemWeight: product.itemWeight?.toString() ?? "",
        dimensionUnit: product.dimensionUnit ?? "in",
        weightUnit: product.weightUnit ?? "lb",
        packagingImageUrl: product.packagingImageUrl ?? "",
      }}
    />
  );
}
