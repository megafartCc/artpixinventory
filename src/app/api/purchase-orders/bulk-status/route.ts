import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  canApprovePurchaseOrders,
  canManagePurchaseOrders,
} from "@/lib/permissions";
import { purchaseOrderStatusSchema } from "@/lib/purchase-order-schemas";

function canRunAction(role: string | undefined, action: string) {
  if (["APPROVE", "REJECT"].includes(action)) {
    return canApprovePurchaseOrders(role);
  }

  return canManagePurchaseOrders(role);
}

export async function POST(request: Request) {
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

  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one purchase order." }, { status: 400 });
  }

  if (!canRunAction(session.user.role, parsed.data.action)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const results = await prisma.$transaction(async (tx) => {
      const updated: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const id of ids) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id },
          include: {
            items: {
              select: {
                receivedQty: true,
              },
            },
          },
        });

        if (!po) {
          skipped.push({ id, reason: "not found" });
          continue;
        }

        const allUnreceived = po.items.every((item) => item.receivedQty === 0);

        try {
          switch (parsed.data.action) {
            case "SUBMIT":
              if (po.status !== "DRAFT") {
                throw new Error("only draft POs can be submitted");
              }
              await tx.purchaseOrder.update({
                where: { id },
                data: { status: "PENDING_APPROVAL" },
              });
              updated.push(id);
              break;
            case "APPROVE":
              if (po.status !== "PENDING_APPROVAL") {
                throw new Error("only pending POs can be approved");
              }
              await tx.purchaseOrder.update({
                where: { id },
                data: {
                  status: "APPROVED",
                  approvedById: session.user.id,
                  approvedAt: new Date(),
                },
              });
              updated.push(id);
              break;
            case "REJECT":
              if (po.status !== "PENDING_APPROVAL") {
                throw new Error("only pending POs can be rejected");
              }
              await tx.purchaseOrder.update({
                where: { id },
                data: {
                  status: "DRAFT",
                  approvedById: null,
                  approvedAt: null,
                },
              });
              updated.push(id);
              break;
            case "MARK_ORDERED":
              if (po.status !== "APPROVED") {
                throw new Error("only approved POs can be marked ordered");
              }
              await tx.purchaseOrder.update({
                where: { id },
                data: { status: "ORDERED" },
              });
              updated.push(id);
              break;
            case "CANCEL":
              if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED"].includes(po.status)) {
                throw new Error("PO cannot be cancelled");
              }
              if (!allUnreceived) {
                throw new Error("received POs cannot be cancelled");
              }
              await tx.purchaseOrder.update({
                where: { id },
                data: { status: "CANCELLED" },
              });
              updated.push(id);
              break;
          }
        } catch (error) {
          skipped.push({
            id,
            reason: error instanceof Error ? error.message : "failed",
          });
        }
      }

      return { updated, skipped };
    });

    return NextResponse.json({
      message: `Updated ${results.updated.length} purchase orders.`,
      data: results,
    });
  } catch (error) {
    console.error("POST /api/purchase-orders/bulk-status failed", error);
    return NextResponse.json(
      { error: "Failed to update purchase orders." },
      { status: 500 }
    );
  }
}
