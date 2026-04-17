import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageReceiving } from "@/lib/permissions";
import { palletPlaceSchema } from "@/lib/receiving-schemas";
import { adjustStockLevel, createActivityLog } from "@/lib/inventory-utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageReceiving(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = palletPlaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid pallet placement payload." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pallet = await tx.pallet.findUnique({
        where: { palletNumber: parsed.data.palletNumber },
        include: {
          receivingSession: {
            select: { id: true, locationId: true },
          },
          items: {
            select: { productId: true, quantity: true },
          },
        },
      });

      if (!pallet) {
        throw new Error("Pallet was not found.");
      }

      if (pallet.status === "PLACED") {
        throw new Error("Pallet has already been placed.");
      }

      const location = await tx.location.findFirst({
        where: {
          qrCode: parsed.data.locationQrCode,
          active: true,
        },
        select: { id: true, name: true },
      });

      if (!location) {
        throw new Error("Destination location QR was not found.");
      }

      for (const item of pallet.items) {
        const sourceResult = await adjustStockLevel(tx, {
          productId: item.productId,
          locationId: pallet.receivingSession.locationId,
          delta: -item.quantity,
        });
        const targetResult = await adjustStockLevel(tx, {
          productId: item.productId,
          locationId: location.id,
          delta: item.quantity,
        });

        await createActivityLog(tx, {
          action: "PALLET_PLACED",
          entityType: "Pallet",
          entityId: pallet.id,
          userId: session.user.id,
          details: {
            productId: item.productId,
            palletNumber: pallet.palletNumber,
            fromLocationId: pallet.receivingSession.locationId,
            toLocationId: location.id,
            quantity: item.quantity,
            sourceBeforeQty: sourceResult.previousQty,
            sourceAfterQty: sourceResult.nextQty,
            targetBeforeQty: targetResult.previousQty,
            targetAfterQty: targetResult.nextQty,
          } as Prisma.InputJsonValue,
        });
      }

      await tx.pallet.update({
        where: { id: pallet.id },
        data: {
          status: "PLACED",
          placedAtLocationId: location.id,
          placedAt: new Date(),
        },
      });

      return { palletNumber: pallet.palletNumber, locationName: location.name };
    });

    return NextResponse.json({
      data: result,
      message: `Pallet ${result.palletNumber} placed at ${result.locationName}.`,
    });
  } catch (error) {
    console.error("POST /api/pallets/place failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to place pallet.",
      },
      { status: 500 }
    );
  }
}
