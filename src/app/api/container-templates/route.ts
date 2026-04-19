import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageVendors } from "@/lib/permissions";
import { containerTemplateMutationSchema } from "@/lib/container-template-schemas";

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendors(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.containerTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { vendors: true, purchaseOrders: true },
      },
    },
  });

  return NextResponse.json({ data: templates });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendors(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = containerTemplateMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid template payload." },
      { status: 400 }
    );
  }

  try {
    const payload = parsed.data;
    const template = await prisma.containerTemplate.create({
      data: {
        name: payload.name,
        maxWeightKg: toDecimal(payload.maxWeightKg),
        maxPallets: payload.maxPallets,
        maxLooseBoxes: payload.maxLooseBoxes,
        description: payload.description,
        active: payload.active,
      },
    });

    return NextResponse.json(
      { data: template, message: "Container template created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/container-templates failed", error);
    return NextResponse.json(
      { error: "Failed to create container template." },
      { status: 500 }
    );
  }
}
