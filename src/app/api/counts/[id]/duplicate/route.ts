import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageCounts } from "@/lib/permissions";
import { createActivityLog } from "@/lib/inventory-utils";

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

  if (!canManageCounts(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const duplicated = await prisma.$transaction(async (tx) => {
      const existing = await tx.countSession.findUnique({
        where: { id: params.id },
      });

      if (!existing) {
        throw new Error("Count session not found.");
      }

      const created = await tx.countSession.create({
        data: {
          name: `${existing.name} Copy`,
          locationId: existing.locationId,
          type: existing.type,
          assignedToId: existing.assignedToId,
          notes: existing.notes,
          duplicatedFromId: existing.id,
        },
        select: { id: true, name: true },
      });

      await createActivityLog(tx, {
        action: "COUNT_DUPLICATED",
        entityType: "CountSession",
        entityId: created.id,
        userId: session.user.id,
        details: {
          duplicatedFromId: existing.id,
          duplicatedFromName: existing.name,
        },
      });

      return created;
    });

    return NextResponse.json({
      data: duplicated,
      message: "Count session duplicated.",
    });
  } catch (error) {
    console.error("POST /api/counts/[id]/duplicate failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to duplicate count session.",
      },
      { status: 500 }
    );
  }
}
