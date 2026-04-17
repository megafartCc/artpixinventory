import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageVendors } from "@/lib/permissions";
import { vendorMutationSchema } from "@/lib/vendor-schemas";

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
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: payload.enableContainerConstraints
        ? payload
        : { ...payload, containerTemplateId: null },
    });

    return NextResponse.json({ data: vendor, message: "Vendor updated." });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }

    console.error("PATCH /api/vendors/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update vendor." },
      { status: 500 }
    );
  }
}
