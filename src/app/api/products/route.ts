import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageCatalog } from "@/lib/permissions";
import { productMutationSchema } from "@/lib/product-schemas";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageCatalog(session.user.role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = productMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid product payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const indexExists = await prisma.productIndex.findUnique({
    where: { id: payload.indexId },
    select: { id: true },
  });

  if (!indexExists) {
    return NextResponse.json(
      { error: "Selected index does not exist." },
      { status: 400 }
    );
  }

  try {
    const product = await prisma.product.create({
      data: {
        compoundId: payload.compoundId,
        name: payload.name,
        indexId: payload.indexId,
        uom: payload.uom,
        barcode: payload.barcode,
        minStock: payload.minStock,
        notes: payload.notes,
        length: toDecimal(payload.length),
        width: toDecimal(payload.width),
        height: toDecimal(payload.height),
        weight: toDecimal(payload.weight),
        itemsPerBox: payload.itemsPerBox,
        boxesPerPallet: payload.boxesPerPallet,
        itemWeight: toDecimal(payload.itemWeight),
        dimensionUnit: payload.dimensionUnit,
        weightUnit: payload.weightUnit,
        categories: {
          create: payload.categories.map((name) => ({
            category: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
      },
      select: {
        id: true,
        compoundId: true,
        name: true,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleProductWriteError("POST /api/products failed", error);
  }
}

function toDecimal(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

function handleProductWriteError(logLabel: string, error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "Compound ID or barcode already exists." },
      { status: 409 }
    );
  }

  console.error(logLabel, error);
  return NextResponse.json(
    { error: "Failed to save product." },
    { status: 500 }
  );
}
