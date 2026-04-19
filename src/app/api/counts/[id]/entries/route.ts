import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canPerformCounts, canReviewCounts } from "@/lib/permissions";
import { countEntrySchema } from "@/lib/count-schemas";
import { createActivityLog } from "@/lib/inventory-utils";

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

  if (!canPerformCounts(session.user.role) && !canReviewCounts(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = countEntrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid count entry payload." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const countSession = await tx.countSession.findUnique({
        where: { id: params.id },
        include: {
          location: { select: { id: true, name: true } },
        },
      });

      if (!countSession) {
        throw new Error("Count session not found.");
      }

      if (countSession.status !== "IN_PROGRESS") {
        throw new Error("This count session is no longer accepting entries.");
      }

      if (
        countSession.assignedToId &&
        countSession.assignedToId !== session.user.id &&
        !canReviewCounts(session.user.role)
      ) {
        throw new Error("This count session is assigned to another user.");
      }

      const normalizedScan = parsed.data.scanValue.trim();
      const product = await tx.product.findFirst({
        where: {
          active: true,
          OR: [
            { compoundId: { equals: normalizedScan, mode: "insensitive" } },
            { barcode: { equals: normalizedScan, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          compoundId: true,
          name: true,
        },
      });

      if (!product) {
        throw new Error("Scanned product was not found in the active catalog.");
      }

      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          productId_locationId: {
            productId: product.id,
            locationId: countSession.locationId,
          },
        },
        select: { quantity: true },
      });

      const expectedQty = stockLevel?.quantity ?? 0;
      const variance = parsed.data.countedQty - expectedQty;

      const entry = await tx.countEntry.upsert({
        where: {
          countSessionId_productId: {
            countSessionId: countSession.id,
            productId: product.id,
          },
        },
        update: {
          countedQty: parsed.data.countedQty,
          expectedQty,
          variance,
          countedById: session.user.id,
          notes: parsed.data.notes,
          scannedAt: new Date(),
        },
        create: {
          countSessionId: countSession.id,
          productId: product.id,
          countedQty: parsed.data.countedQty,
          expectedQty,
          variance,
          countedById: session.user.id,
          notes: parsed.data.notes,
        },
        select: { id: true },
      });

      await createActivityLog(tx, {
        action: "COUNT_ENTRY_CAPTURED",
        entityType: "CountSession",
        entityId: countSession.id,
        userId: session.user.id,
        details: {
          productId: product.id,
          compoundId: product.compoundId,
          countedQty: parsed.data.countedQty,
          expectedQty,
          variance,
          locationId: countSession.locationId,
          locationName: countSession.location.name,
        } as Prisma.InputJsonValue,
      });

      return {
        entryId: entry.id,
        productName: product.name,
      };
    });

    return NextResponse.json({
      data: result,
      message: `Count entry saved for ${result.productName}.`,
    });
  } catch (error) {
    console.error("POST /api/counts/[id]/entries failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save count entry.",
      },
      { status: 500 }
    );
  }
}
