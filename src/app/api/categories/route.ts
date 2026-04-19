import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { categoryMutationSchema } from "@/lib/category-schemas";
import { canManageCatalog } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageCatalog(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { products: true, children: true },
      },
    },
  });

  return NextResponse.json({ data: categories });
}

export async function POST(request: Request) {
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

  if (payload.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: payload.parentId },
      select: { id: true },
    });

    if (!parent) {
      return NextResponse.json(
        { error: "Selected parent category does not exist." },
        { status: 400 }
      );
    }
  }

  try {
    const category = await prisma.category.create({
      data: payload,
    });

    return NextResponse.json(
      { data: category, message: "Category created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/categories failed", error);
    return NextResponse.json(
      { error: "Failed to create category." },
      { status: 500 }
    );
  }
}
