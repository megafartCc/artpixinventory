import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canAdjustStock } from "@/lib/permissions";
import { stockAdjustmentSchema } from "@/lib/stock-schemas";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAdjustStock(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = stockAdjustmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid adjustment payload." },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const [product, location] = await Promise.all([
    prisma.product.findUnique({
      where: { id: payload.productId },
      select: { id: true },
    }),
    prisma.location.findUnique({
      where: { id: payload.locationId },
      select: { id: true },
    }),
  ]);

  if (!product?.id || !location?.id) {
    return NextResponse.json(
      { error: "Product or location was not found." },
      { status: 404 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingStock = await tx.stockLevel.findUnique({
        where: {
          productId_locationId: {
            productId: payload.productId,
            locationId: payload.locationId,
          },
        },
        select: { id: true, quantity: true },
      });

      const previousQty = existingStock?.quantity ?? 0;

      const stockLevel = await tx.stockLevel.upsert({
        where: {
          productId_locationId: {
            productId: payload.productId,
            locationId: payload.locationId,
          },
        },
        update: { quantity: payload.newQty },
        create: {
          productId: payload.productId,
          locationId: payload.locationId,
          quantity: payload.newQty,
        },
      });

      const adjustment = await tx.stockAdjustment.create({
        data: {
          productId: payload.productId,
          locationId: payload.locationId,
          previousQty,
          newQty: payload.newQty,
          reason: payload.reason,
          notes: payload.notes,
          adjustedById: session.user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          action: "STOCK_ADJUSTED",
          entityType: "StockLevel",
          entityId: stockLevel.id,
          userId: session.user.id,
          details: {
            beforeQty: previousQty,
            afterQty: payload.newQty,
            productId: payload.productId,
            locationId: payload.locationId,
            reason: payload.reason,
          } as Prisma.InputJsonValue,
        },
      });

      return { stockLevel, adjustment };
    });

    return NextResponse.json({
      data: result,
      message: "Stock adjusted.",
    });
  } catch (error) {
    console.error("POST /api/stock/adjustments failed", error);
    return NextResponse.json(
      { error: "Failed to adjust stock." },
      { status: 500 }
    );
  }
}
