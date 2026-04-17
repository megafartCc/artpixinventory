import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageTransfers } from "@/lib/permissions";
import { transferStatusSchema } from "@/lib/transfer-schemas";
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
  const parsed = transferStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid transfer action." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: params.id },
        include: {
          picks: {
            select: {
              productId: true,
              fromLocationId: true,
              quantity: true,
            },
          },
          drops: {
            select: {
              productId: true,
              toLocationId: true,
              quantity: true,
            },
          },
        },
      });

      if (!transfer) {
        throw new Error("Transfer not found.");
      }

      if (parsed.data.action === "START_DROPOFF") {
        if (transfer.status !== "COLLECTING") {
          throw new Error("Transfer is already in drop-off mode.");
        }

        await tx.transfer.update({
          where: { id: transfer.id },
          data: { status: "DROPPING" },
        });

        return { message: "Transfer switched to drop-off mode." };
      }

      if (transfer.status === "COMPLETED" || transfer.status === "CANCELLED") {
        throw new Error("Completed or cancelled transfers cannot be changed.");
      }

      for (const drop of transfer.drops) {
        const destinationResult = await adjustStockLevel(tx, {
          productId: drop.productId,
          locationId: drop.toLocationId,
          delta: -drop.quantity,
        });

        await createActivityLog(tx, {
          action: "TRANSFER_CANCEL_REVERSE_DROP",
          entityType: "Transfer",
          entityId: transfer.id,
          userId: session.user.id,
          details: {
            productId: drop.productId,
            locationId: drop.toLocationId,
            quantity: drop.quantity,
            beforeQty: destinationResult.previousQty,
            afterQty: destinationResult.nextQty,
          } as Prisma.InputJsonValue,
        });
      }

      for (const pick of transfer.picks) {
        const sourceResult = await adjustStockLevel(tx, {
          productId: pick.productId,
          locationId: pick.fromLocationId,
          delta: pick.quantity,
        });

        await createActivityLog(tx, {
          action: "TRANSFER_CANCEL_RETURN",
          entityType: "Transfer",
          entityId: transfer.id,
          userId: session.user.id,
          details: {
            productId: pick.productId,
            locationId: pick.fromLocationId,
            quantity: pick.quantity,
            beforeQty: sourceResult.previousQty,
            afterQty: sourceResult.nextQty,
          } as Prisma.InputJsonValue,
        });
      }

      await tx.transfer.update({
        where: { id: transfer.id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
        },
      });

      return { message: "Transfer cancelled and stock returned." };
    });

    return NextResponse.json({ message: result.message });
  } catch (error) {
    console.error("POST /api/transfers/[id]/status failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update transfer.",
      },
      { status: 500 }
    );
  }
}
