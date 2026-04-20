import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageCatalog } from "@/lib/permissions";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageCatalog(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    ids?: string[];
    active?: boolean;
  };

  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one product." }, { status: 400 });
  }

  const active = body.active ?? false;

  try {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { active },
    });

    return NextResponse.json({
      message: active
        ? `Activated ${result.count} products.`
        : `Deactivated ${result.count} products.`,
      count: result.count,
    });
  } catch (error) {
    console.error("POST /api/products/bulk-update failed", error);
    return NextResponse.json(
      { error: "Failed to update products." },
      { status: 500 }
    );
  }
}
