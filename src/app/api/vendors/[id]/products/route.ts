import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageVendors } from "@/lib/permissions";
import { productVendorMutationSchema } from "@/lib/product-vendor-schemas";

function toDecimal(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendors(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = productVendorMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid mapping payload." },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const [vendor, product] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: params.id },
      select: { id: true },
    }),
    prisma.product.findUnique({
      where: { id: payload.productId },
      select: { id: true, active: true },
    }),
  ]);

  if (!vendor?.id || !product?.id) {
    return NextResponse.json(
      { error: "Vendor or product was not found." },
      { status: 404 }
    );
  }

  try {
    const mapping = await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.productVendor.updateMany({
          where: {
            vendorId: params.id,
            isDefault: true,
            NOT: { productId: payload.productId },
          },
          data: { isDefault: false },
        });
      }

      return tx.productVendor.upsert({
        where: {
          productId_vendorId: {
            productId: payload.productId,
            vendorId: params.id,
          },
        },
        update: {
          isDefault: payload.isDefault,
          moq: payload.moq,
          unitCost: toDecimal(payload.unitCost),
          leadTimeDays: payload.leadTimeDays,
          vendorSku: payload.vendorSku,
          notes: payload.notes,
        },
        create: {
          productId: payload.productId,
          vendorId: params.id,
          isDefault: payload.isDefault,
          moq: payload.moq,
          unitCost: toDecimal(payload.unitCost),
          leadTimeDays: payload.leadTimeDays,
          vendorSku: payload.vendorSku,
          notes: payload.notes,
        },
      });
    });

    return NextResponse.json({
      data: mapping,
      message: "Vendor mapping saved.",
    });
  } catch (error) {
    console.error("POST /api/vendors/[id]/products failed", error);
    return NextResponse.json(
      { error: "Failed to save vendor mapping." },
      { status: 500 }
    );
  }
}
