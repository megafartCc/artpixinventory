import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageVendorCredits } from "@/lib/permissions";
import { vendorCreditCreateSchema } from "@/lib/vendor-credit-schemas";
import { generateNextReference } from "@/lib/inventory-utils";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendorCredits(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const credits = await prisma.vendorCredit.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { name: true } },
      purchaseOrder: { select: { poNumber: true } },
      items: { select: { id: true, quantity: true } },
    },
  });

  return NextResponse.json({ data: credits });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendorCredits(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = vendorCreditCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid vendor credit payload." },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const creditNumber = await generateNextReference(async (prefix) => {
        const latest = await tx.vendorCredit.findFirst({
          where: { creditNumber: { startsWith: prefix } },
          orderBy: { creditNumber: "desc" },
          select: { creditNumber: true },
        });
        return latest?.creditNumber ?? null;
      }, "VC");

      const totalAmount = parsed.data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost,
        0
      );

      const credit = await tx.vendorCredit.create({
        data: {
          creditNumber,
          vendorId: parsed.data.vendorId,
          purchaseOrderId: parsed.data.purchaseOrderId,
          reason: parsed.data.reason,
          totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
          notes: parsed.data.notes,
          createdById: session.user.id,
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: new Prisma.Decimal(item.unitCost.toFixed(2)),
              totalCredit: new Prisma.Decimal((item.quantity * item.unitCost).toFixed(2)),
              notes: item.notes,
            })),
          },
        },
        include: { items: true },
      });

      await tx.activityLog.create({
        data: {
          action: "VENDOR_CREDIT_CREATED",
          entityType: "VendorCredit",
          entityId: credit.id,
          userId: session.user.id,
          details: {
            creditNumber: credit.creditNumber,
            totalAmount: credit.totalAmount.toString(),
            itemCount: credit.items.length,
          } as Prisma.InputJsonValue,
        },
      });

      return credit;
    });

    return NextResponse.json({ data: created, message: "Vendor credit created." });
  } catch (error) {
    console.error("POST /api/vendor-credits failed", error);
    return NextResponse.json({ error: "Failed to create vendor credit." }, { status: 500 });
  }
}
