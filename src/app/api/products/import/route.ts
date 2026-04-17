import { NextResponse } from "next/server";
import { AdjustmentReason, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canImportCatalog } from "@/lib/permissions";

const importRowSchema = z.object({
  compoundId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  index: z.string().trim().min(1),
  category: z.string().trim().optional().default(""),
  uom: z.string().trim().optional().default("pcs"),
  barcode: z.string().trim().optional().default(""),
  minStock: z.string().trim().optional().default("0"),
  quantity: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""),
});

const importPayloadSchema = z.object({
  rows: z.array(importRowSchema).min(1, "At least one mapped row is required."),
});

function parseCategoryNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[|;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function parseNonNegativeInt(value: string, fallback = 0) {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canImportCatalog(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = importPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid import payload." },
      { status: 400 }
    );
  }

  const rows = parsed.data.rows;
  const [indexes, locations, existingProducts] = await Promise.all([
    prisma.productIndex.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      select: { compoundId: true },
    }),
  ]);

  const indexMap = new Map(
    indexes.map((index) => [index.name.trim().toLowerCase(), index])
  );
  const locationMap = new Map(
    locations.map((location) => [location.name.trim().toLowerCase(), location])
  );
  const seenCompoundIds = new Set(
    existingProducts.map((product) => product.compoundId.toUpperCase())
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const normalizedCompoundId = row.compoundId.trim().toUpperCase();

    if (seenCompoundIds.has(normalizedCompoundId)) {
      skipped += 1;
      continue;
    }

    const index = indexMap.get(row.index.trim().toLowerCase());
    if (!index) {
      errors.push(`Row ${rowIndex + 2}: index "${row.index}" was not found.`);
      continue;
    }

    const minStock = parseNonNegativeInt(row.minStock, 0);
    if (Number.isNaN(minStock)) {
      errors.push(`Row ${rowIndex + 2}: minStock must be a non-negative integer.`);
      continue;
    }

    const quantity = parseNonNegativeInt(row.quantity, 0);
    if (Number.isNaN(quantity)) {
      errors.push(`Row ${rowIndex + 2}: quantity must be a non-negative integer.`);
      continue;
    }

    const location =
      row.location.trim().length > 0
        ? locationMap.get(row.location.trim().toLowerCase())
        : null;

    if (row.location.trim().length > 0 && !location) {
      errors.push(`Row ${rowIndex + 2}: location "${row.location}" was not found.`);
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            compoundId: normalizedCompoundId,
            name: row.name.trim(),
            indexId: index.id,
            uom: row.uom.trim() || "pcs",
            barcode: row.barcode.trim() || null,
            minStock,
            categories: {
              create: parseCategoryNames(row.category).map((name) => ({
                category: {
                  connectOrCreate: {
                    where: { name },
                    create: { name },
                  },
                },
              })),
            },
          },
        });

        if (location && quantity > 0) {
          await tx.stockLevel.create({
            data: {
              productId: product.id,
              locationId: location.id,
              quantity,
            },
          });

          await tx.stockAdjustment.create({
            data: {
              productId: product.id,
              locationId: location.id,
              previousQty: 0,
              newQty: quantity,
              reason: AdjustmentReason.INITIAL_SETUP,
              notes: "Created from CSV import.",
              adjustedById: session.user.id,
            },
          });

          await tx.activityLog.create({
            data: {
              action: "STOCK_ADJUSTED",
              entityType: "StockLevel",
              entityId: `${product.id}:${location.id}`,
              userId: session.user.id,
              details: {
                beforeQty: 0,
                afterQty: quantity,
                productId: product.id,
                locationId: location.id,
                reason: AdjustmentReason.INITIAL_SETUP,
              } as Prisma.InputJsonValue,
            },
          });
        }
      });

      created += 1;
      seenCompoundIds.add(normalizedCompoundId);
    } catch (error) {
      console.error(`POST /api/products/import row ${rowIndex + 2} failed`, error);
      errors.push(`Row ${rowIndex + 2}: import failed.`);
    }
  }

  return NextResponse.json({
    data: {
      created,
      skipped,
      errors,
    },
    message: "CSV import processed.",
  });
}
