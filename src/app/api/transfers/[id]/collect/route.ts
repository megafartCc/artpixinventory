import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageTransfers } from "@/lib/permissions";
import { transferCollectSchema } from "@/lib/transfer-schemas";
import { adjustStockLevel, createActivityLog } from "@/lib/inventory-utils";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageTransfers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = transferCollectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid collect payload." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: params.id },
        select: { id: true, status: true, reference: true },
      });

      if (!transfer) {
        throw new Error("Transfer not found.");
      }

      if (transfer.status !== "COLLECTING") {
        throw new Error("Transfer is no longer in collection mode.");
      }

      const location = await tx.location.findFirst({
        where: { qrCode: parsed.data.locationQrCode, active: true },
        select: { id: true, name: true },
      });

      if (!location) {
        throw new Error("Source location QR was not found.");
      }

      const stockResult = await adjustStockLevel(tx, {
        productId: parsed.data.productId,
        locationId: location.id,
        delta: -parsed.data.quantity,
      });

      const pick = await tx.transferPick.create({
        data: {
          transferId: transfer.id,
          productId: parsed.data.productId,
          fromLocationId: location.id,
          quantity: parsed.data.quantity,
        },
      });

      await createActivityLog(tx, {
        action: "TRANSFER_PICKED",
        entityType: "Transfer",
        entityId: transfer.id,
        userId: session.user.id,
        details: {
          transferReference: transfer.reference,
          productId: parsed.data.productId,
          fromLocationId: location.id,
          quantity: parsed.data.quantity,
          beforeQty: stockResult.previousQty,
          afterQty: stockResult.nextQty,
        } as Prisma.InputJsonValue,
      });

      return { pickId: pick.id, locationName: location.name };
    });

    return NextResponse.json({
      data: result,
      message: `Picked stock from ${result.locationName}.`,
    });
  } catch (error) {
    console.error("POST /api/transfers/[id]/collect failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to collect transfer stock.",
      },
      { status: 500 }
    );
  }
}
