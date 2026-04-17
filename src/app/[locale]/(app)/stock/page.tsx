import { unstable_noStore as noStore } from "next/cache";
import { ReservationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { flattenLocationsForSelect } from "@/lib/location-utils";
import { StockLevelsClient } from "@/components/stock/StockLevelsClient";

export default async function StockPage() {
  noStore();

  const [products, indexes, categories, locations, reservations] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { compoundId: "asc" },
      include: {
        index: { select: { id: true, name: true } },
        categories: {
          select: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
        stockLevels: {
          select: {
            locationId: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.productIndex.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true, type: true },
    }),
    prisma.stockReservation.groupBy({
      by: ["productId"],
      where: { status: ReservationStatus.RESERVED },
      _sum: { quantity: true },
    }),
  ]);

  const reservationMap = new Map(
    reservations.map((entry) => [entry.productId, entry._sum.quantity ?? 0])
  );
  const flattenedLocations = flattenLocationsForSelect(locations);

  return (
    <StockLevelsClient
      initialProducts={products.map((product) => ({
        id: product.id,
        compoundId: product.compoundId,
        name: product.name,
        indexId: product.index.id,
        indexName: product.index.name,
        categories: product.categories.map((entry) => entry.category.name),
        minStock: product.minStock,
        reservedQty: reservationMap.get(product.id) ?? 0,
        stockByLocation: Object.fromEntries(
          product.stockLevels.map((stockLevel) => [
            stockLevel.locationId,
            stockLevel.quantity,
          ])
        ),
      }))}
      indexes={indexes}
      categories={categories}
      locationColumns={flattenedLocations}
    />
  );
}
