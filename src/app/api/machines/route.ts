import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { machineMutationSchema } from "@/lib/machine-schemas";
import { canManageMachines } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMachines(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const machines = await prisma.machine.findMany({
    orderBy: { name: "asc" },
    include: {
      location: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  return NextResponse.json({ data: machines });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMachines(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = machineMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const location = await prisma.location.findUnique({
    where: { id: payload.locationId },
    select: {
      id: true,
      type: true,
      parentId: true,
      parent: {
        select: { id: true, type: true },
      },
    },
  });

  if (!location) {
    return NextResponse.json(
      { error: "Selected sublocation does not exist." },
      { status: 400 }
    );
  }

  const parentIsProduction = location.parent?.type === "PRODUCTION";

  if (location.type !== "PRODUCTION" && !parentIsProduction) {
    return NextResponse.json(
      { error: "Machines must be assigned to a production sublocation." },
      { status: 400 }
    );
  }

  try {
    const machine = await prisma.machine.create({
      data: payload,
    });

    return NextResponse.json(
      { data: machine, message: "Machine created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/machines failed", error);
    return NextResponse.json(
      { error: "Failed to create machine." },
      { status: 500 }
    );
  }
}
