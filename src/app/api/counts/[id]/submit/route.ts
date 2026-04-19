import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canPerformCounts, canReviewCounts } from "@/lib/permissions";
import { createActivityLog } from "@/lib/inventory-utils";
import { sendSlackNotification } from "@/lib/slack";

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

  if (!canPerformCounts(session.user.role) && !canReviewCounts(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const countSession = await tx.countSession.findUnique({
        where: { id: params.id },
        include: {
          entries: { select: { id: true } },
          location: { select: { name: true } },
        },
      });

      if (!countSession) {
        throw new Error("Count session not found.");
      }

      if (countSession.status !== "IN_PROGRESS") {
        throw new Error("Count session has already been submitted.");
      }

      if (countSession.entries.length === 0) {
        throw new Error("Add at least one count entry before submitting.");
      }

      if (
        countSession.assignedToId &&
        countSession.assignedToId !== session.user.id &&
        !canReviewCounts(session.user.role)
      ) {
        throw new Error("This count session is assigned to another user.");
      }

      await tx.countSession.update({
        where: { id: countSession.id },
        data: {
          status: "SUBMITTED",
          completedAt: new Date(),
        },
      });

      await createActivityLog(tx, {
        action: "COUNT_SUBMITTED",
        entityType: "CountSession",
        entityId: countSession.id,
        userId: session.user.id,
        details: {
          name: countSession.name,
          locationName: countSession.location.name,
          entryCount: countSession.entries.length,
        },
      });

      return {
        id: countSession.id,
        name: countSession.name,
        locationName: countSession.location.name,
        entryCount: countSession.entries.length,
      };
    });

    await sendSlackNotification({
      type: "COUNT_SUBMITTED",
      channel: "#inventory-alerts",
      message: `Count submitted: ${result.name} at ${result.locationName} with ${result.entryCount} scanned entries.`,
      entityType: "CountSession",
      entityId: result.id,
    });

    return NextResponse.json({
      data: result,
      message: "Count session submitted for review.",
    });
  } catch (error) {
    console.error("POST /api/counts/[id]/submit failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit count session.",
      },
      { status: 500 }
    );
  }
}
