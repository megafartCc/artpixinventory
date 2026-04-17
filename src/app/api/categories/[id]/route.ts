import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { categoryMutationSchema } from "@/lib/category-schemas";
import { collectDescendantIds } from "@/lib/location-utils";
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
  const parsed = categoryMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });

  if (payload.parentId === params.id) {
    return NextResponse.json(
      { error: "A category cannot be its own parent." },
      { status: 400 }
    );
  }

  if (payload.parentId) {
    const descendants = collectDescendantIds(categories, params.id);
    if (descendants.has(payload.parentId)) {
      return NextResponse.json(
        { error: "A category cannot be moved under its own descendant." },
        { status: 400 }
      );
    }
  }

  try {
    const category = await prisma.category.update({
      where: { id: params.id },
      data: payload,
    });

    return NextResponse.json({ data: category, message: "Category updated." });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 }
      );
    }

    console.error("PATCH /api/categories/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update category." },
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

  const category = await prisma.category.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: { products: true, children: true },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (category._count.products > 0) {
    return NextResponse.json(
      { error: "Categories with assigned products cannot be deleted." },
      { status: 409 }
    );
  }

  if (category._count.children > 0) {
    return NextResponse.json(
      { error: "Categories with child categories cannot be deleted." },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id: params.id } });

  return NextResponse.json({ message: "Category deleted." });
}
