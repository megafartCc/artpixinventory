import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { machineMutationSchema } from "@/lib/machine-schemas";
import { canManageMachines } from "@/lib/permissions";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const location = await prisma.location.findUnique({
    where: { id: parsed.data.locationId },
    select: {
      id: true,
      type: true,
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
    const machine = await prisma.machine.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ data: machine, message: "Machine updated." });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Machine not found." }, { status: 404 });
    }

    console.error("PATCH /api/machines/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update machine." },
      { status: 500 }
    );
  }
}
