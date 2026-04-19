import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReviewCounts } from "@/lib/permissions";
import { adjustStockLevel, createActivityLog } from "@/lib/inventory-utils";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canReviewCounts(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const countSession = await tx.countSession.findUnique({
        where: { id: params.id },
        include: {
          entries: {
            include: {
              product: {
                select: {
                  id: true,
                  compoundId: true,
                  name: true,
                },
              },
            },
          },
          location: { select: { id: true, name: true } },
        },
      });

      if (!countSession) {
        throw new Error("Count session not found.");
      }

      if (!["SUBMITTED", "REVIEWING"].includes(countSession.status)) {
        throw new Error("Only submitted count sessions can be approved.");
      }

      for (const entry of countSession.entries) {
        if (entry.variance === 0) {
          continue;
        }

        const stockResult = await adjustStockLevel(tx, {
          productId: entry.productId,
          locationId: countSession.locationId,
          delta: entry.variance,
        });

        await tx.stockAdjustment.create({
          data: {
            productId: entry.productId,
            locationId: countSession.locationId,
            previousQty: stockResult.previousQty,
            newQty: stockResult.nextQty,
            reason: "COUNT_VARIANCE",
            notes: `Approved from count session ${countSession.name}`,
            adjustedById: session.user.id,
          },
        });

        await createActivityLog(tx, {
          action: "COUNT_VARIANCE_APPLIED",
          entityType: "CountSession",
          entityId: countSession.id,
          userId: session.user.id,
          details: {
            productId: entry.productId,
            compoundId: entry.product.compoundId,
            locationId: countSession.locationId,
            locationName: countSession.location.name,
            variance: entry.variance,
            beforeQty: stockResult.previousQty,
            afterQty: stockResult.nextQty,
          } as Prisma.InputJsonValue,
        });
      }

      await tx.countSession.update({
        where: { id: countSession.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      });

      await createActivityLog(tx, {
        action: "COUNT_APPROVED",
        entityType: "CountSession",
        entityId: countSession.id,
        userId: session.user.id,
        details: {
          name: countSession.name,
          varianceCount: countSession.entries.filter((entry) => entry.variance !== 0).length,
        },
      });

      return {
        approvedCount: countSession.entries.length,
      };
    });

    return NextResponse.json({
      data: result,
      message: "Count session approved and stock variances applied.",
    });
  } catch (error) {
    console.error("POST /api/counts/[id]/review failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to approve count session.",
      },
      { status: 500 }
    );
  }
}
