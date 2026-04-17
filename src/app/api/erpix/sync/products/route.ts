import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { validateErpixApiKey } from "@/lib/erpix-client";
import { erpixSyncProductsSchema } from "@/lib/erpix-schemas";

function toDecimal(value: number | null) {
  if (value === null) {
    return null;
  }
  return new Prisma.Decimal(value);
}

export async function POST(request: Request) {
  const authError = validateErpixApiKey(request);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const parsed = erpixSyncProductsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid product sync payload." },
      { status: 400 }
    );
  }

  const updated = [] as Array<{ id: string; erpixId: string }>;

  for (const item of parsed.data) {
    const product = await prisma.product.update({
      where: { erpixId: item.erpixId },
      data: {
        imageUrl: item.imageUrl,
        weight: toDecimal(item.weight),
        length: toDecimal(item.length),
        width: toDecimal(item.width),
        height: toDecimal(item.height),
      },
      select: { id: true, erpixId: true },
    });

    updated.push({ id: product.id, erpixId: product.erpixId ?? item.erpixId });
  }

  return NextResponse.json({ data: updated, message: "Products synced." });
}
