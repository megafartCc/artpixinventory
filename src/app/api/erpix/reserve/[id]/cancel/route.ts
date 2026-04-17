import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateErpixApiKey } from "@/lib/erpix-client";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = validateErpixApiKey(request);
  if (authError) {
    return authError;
  }

  const reservation = await prisma.stockReservation.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (reservation.status !== "RESERVED") {
    return NextResponse.json({ error: "Only RESERVED entries can be cancelled." }, { status: 400 });
  }

  const updated = await prisma.stockReservation.update({
    where: { id: reservation.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  return NextResponse.json({ data: updated, message: "Reservation cancelled." });
}
