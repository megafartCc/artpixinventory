import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { indexMutationSchema } from "@/lib/index-schemas";
import { canManageCatalog } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const indexes = await prisma.productIndex.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return NextResponse.json({ data: indexes });
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
  const parsed = indexMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }

  try {
    const index = await prisma.productIndex.create({
      data: parsed.data,
    });

    return NextResponse.json(
      { data: index, message: "Index created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/indexes failed", error);
    return NextResponse.json(
      { error: "Failed to create index." },
      { status: 500 }
    );
  }
}
