import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageCounts } from "@/lib/permissions";
import { countSessionCreateSchema } from "@/lib/count-schemas";
import { createActivityLog } from "@/lib/inventory-utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageCounts(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = countSessionCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid count session payload." },
      { status: 400 }
    );
  }

  try {
    const countSession = await prisma.$transaction(async (tx) => {
      const created = await tx.countSession.create({
        data: {
          name: parsed.data.name,
          locationId: parsed.data.locationId,
          type: parsed.data.type,
          assignedToId: parsed.data.assignedToId,
          notes: parsed.data.notes,
        },
        select: {
          id: true,
          name: true,
        },
      });

      await createActivityLog(tx, {
        action: "COUNT_CREATED",
        entityType: "CountSession",
        entityId: created.id,
        userId: session.user.id,
        details: {
          name: parsed.data.name,
          locationId: parsed.data.locationId,
          type: parsed.data.type,
          assignedToId: parsed.data.assignedToId,
        },
      });

      return created;
    });

    return NextResponse.json({
      data: countSession,
      message: "Count session created.",
    });
  } catch (error) {
    console.error("POST /api/counts failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create count session.",
      },
      { status: 500 }
    );
  }
}
