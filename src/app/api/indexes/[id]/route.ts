import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { indexMutationSchema } from "@/lib/index-schemas";
import { canManageCatalog } from "@/lib/permissions";

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

  if (!canManageCatalog(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = indexMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }

  try {
    const index = await prisma.productIndex.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ data: index, message: "Index updated." });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Index not found." }, { status: 404 });
    }

    console.error("PATCH /api/indexes/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update index." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageCatalog(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const index = await prisma.productIndex.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!index) {
    return NextResponse.json({ error: "Index not found." }, { status: 404 });
  }

  if (index._count.products > 0) {
    return NextResponse.json(
      { error: "Indexes with products cannot be deleted." },
      { status: 409 }
    );
  }

  await prisma.productIndex.delete({ where: { id: params.id } });

  return NextResponse.json({ message: "Index deleted." });
}
