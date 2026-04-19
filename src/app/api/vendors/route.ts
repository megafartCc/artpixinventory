import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageVendors } from "@/lib/permissions";
import { vendorMutationSchema } from "@/lib/vendor-schemas";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendors(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      containerTemplate: {
        select: { id: true, name: true },
      },
      _count: {
        select: { products: true, purchaseOrders: true },
      },
    },
  });

  return NextResponse.json({ data: vendors });
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
  const parsed = vendorMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid vendor payload." },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  if (!payload.enableContainerConstraints && payload.containerTemplateId) {
    return NextResponse.json(
      { error: "Enable container constraints before choosing a default template." },
      { status: 400 }
    );
  }

  if (payload.enableContainerConstraints && payload.containerTemplateId) {
    const template = await prisma.containerTemplate.findUnique({
      where: { id: payload.containerTemplateId },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Selected container template does not exist." },
        { status: 400 }
      );
    }
  }

  try {
    const vendor = await prisma.vendor.create({
      data: payload.enableContainerConstraints
        ? payload
        : { ...payload, containerTemplateId: null },
    });

    return NextResponse.json(
      { data: vendor, message: "Vendor created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/vendors failed", error);
    return NextResponse.json(
      { error: "Failed to create vendor." },
      { status: 500 }
    );
  }
}
