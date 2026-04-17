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
    const template = await prisma.containerTemplate.update({
      where: { id: params.id },
      data: {
        name: payload.name,
        maxWeightKg: toDecimal(payload.maxWeightKg),
        maxPallets: payload.maxPallets,
        maxLooseBoxes: payload.maxLooseBoxes,
        description: payload.description,
        active: payload.active,
      },
    });

    return NextResponse.json({
      data: template,
      message: "Container template updated.",
    });
  } catch (error) {
    console.error("PATCH /api/container-templates/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update container template." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendors(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.containerTemplate.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: { vendors: true, purchaseOrders: true },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  if (template._count.vendors > 0 || template._count.purchaseOrders > 0) {
    return NextResponse.json(
      { error: "Templates in use cannot be deleted." },
      { status: 409 }
    );
  }

  await prisma.containerTemplate.delete({ where: { id: params.id } });

  return NextResponse.json({ message: "Container template deleted." });
}
