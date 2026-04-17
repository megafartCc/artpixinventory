import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  canApprovePurchaseOrders,
  canManagePurchaseOrders,
} from "@/lib/permissions";
import { purchaseOrderStatusSchema } from "@/lib/purchase-order-schemas";

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

  const body = await request.json();
  const parsed = purchaseOrderStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid status action." },
      { status: 400 }
    );
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      items: {
        select: {
          id: true,
          receivedQty: true,
        },
      },
    },
  });

  if (!po) {
    return NextResponse.json(
      { error: "Purchase order not found." },
      { status: 404 }
    );
  }

  const action = parsed.data.action;

  if (
    ["SUBMIT", "MARK_ORDERED", "CANCEL"].includes(action) &&
    !canManagePurchaseOrders(session.user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    ["APPROVE", "REJECT"].includes(action) &&
    !canApprovePurchaseOrders(session.user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allUnreceived = po.items.every((item) => item.receivedQty === 0);

  switch (action) {
    case "SUBMIT":
      if (po.status !== "DRAFT") {
        return NextResponse.json(
          { error: "Only draft purchase orders can be submitted." },
          { status: 409 }
        );
      }
      await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: { status: "PENDING_APPROVAL" },
      });
      return NextResponse.json({
        message: "Purchase order submitted for approval.",
      });

    case "APPROVE":
      if (po.status !== "PENDING_APPROVAL") {
        return NextResponse.json(
          { error: "Only pending purchase orders can be approved." },
          { status: 409 }
        );
      }
      await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: {
          status: "APPROVED",
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
      });
      return NextResponse.json({ message: "Purchase order approved." });

    case "REJECT":
      if (po.status !== "PENDING_APPROVAL") {
        return NextResponse.json(
          { error: "Only pending purchase orders can be rejected." },
          { status: 409 }
        );
      }
      await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: {
          status: "DRAFT",
          approvedById: null,
          approvedAt: null,
        },
      });
      return NextResponse.json({ message: "Purchase order moved back to draft." });

    case "MARK_ORDERED":
      if (po.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Only approved purchase orders can be marked ordered." },
          { status: 409 }
        );
      }
      await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: { status: "ORDERED" },
      });
      return NextResponse.json({ message: "Purchase order marked as ordered." });

    case "CANCEL":
      if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED"].includes(po.status)) {
        return NextResponse.json(
          { error: "This purchase order cannot be cancelled." },
          { status: 409 }
        );
      }
      if (!allUnreceived) {
        return NextResponse.json(
          { error: "Received purchase orders cannot be cancelled." },
          { status: 409 }
        );
      }
      await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ message: "Purchase order cancelled." });

    default:
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
}
