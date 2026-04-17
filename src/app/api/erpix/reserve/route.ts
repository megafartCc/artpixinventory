import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateErpixApiKey } from "@/lib/erpix-client";
import { erpixReserveSchema } from "@/lib/erpix-schemas";

export async function POST(request: Request) {
  const authError = validateErpixApiKey(request);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const parsed = erpixReserveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid ERPIX reserve payload." },
      { status: 400 }
    );
  }

  const product = await prisma.product.findFirst({
    where: { compoundId: parsed.data.compoundId, active: true },
    select: { id: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const reservation = await prisma.stockReservation.create({
    data: {
      productId: product.id,
      quantity: parsed.data.quantity,
      erpixOrderId: parsed.data.erpixOrderId,
      status: "RESERVED",
    },
  });

  return NextResponse.json({ data: reservation, message: "Reservation created." });
}
