import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export async function adjustStockLevel(tx: TxClient, input: {
  productId: string;
  locationId: string;
  delta: number;
}) {
  const existing = await tx.stockLevel.findUnique({
    where: {
      productId_locationId: {
        productId: input.productId,
        locationId: input.locationId,
      },
    },
    select: { id: true, quantity: true },
  });

  const previousQty = existing?.quantity ?? 0;
  const nextQty = previousQty + input.delta;

  if (nextQty < 0) {
    throw new Error("Insufficient stock for the requested movement.");
  }

  const stockLevel = await tx.stockLevel.upsert({
    where: {
      productId_locationId: {
        productId: input.productId,
        locationId: input.locationId,
      },
    },
    update: { quantity: nextQty },
    create: {
      productId: input.productId,
      locationId: input.locationId,
      quantity: nextQty,
    },
  });

  return { stockLevel, previousQty, nextQty };
}

export async function getProductTotalStock(tx: TxClient, productId: string) {
  const aggregate = await tx.stockLevel.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });

  return aggregate._sum.quantity ?? 0;
}

export async function createActivityLog(
  tx: TxClient,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string | null;
    details: Prisma.InputJsonValue;
  }
) {
  return tx.activityLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId ?? null,
      details: input.details,
    },
  });
}

export async function generateNextReference(
  findLatest: (prefix: string) => Promise<string | null>,
  prefixBase: string
) {
  const year = new Date().getFullYear();
  const prefix = `${prefixBase}-${year}-`;
  const latest = await findLatest(prefix);
  const nextSequence = latest
    ? Number.parseInt(latest.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(Number.isFinite(nextSequence) ? nextSequence : 1).padStart(4, "0")}`;
}
