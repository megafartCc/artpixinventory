import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReviewDefects } from "@/lib/permissions";
import { defectReviewSchema } from "@/lib/defect-schemas";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canReviewDefects(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = defectReviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid review payload." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.defectReport.findUnique({
        where: { id: params.id },
        include: {
          machine: { select: { locationId: true } },
          items: true,
        },
      });

      if (!report) {
        throw new Error("Defect report not found.");
      }

      if (report.status !== "PENDING_REVIEW") {
        throw new Error("Only pending defect reports can be reviewed.");
      }

      const reviewNotes = [report.notes, parsed.data.notes].filter(Boolean).join("\n\n").trim() || null;

      if (parsed.data.action === "REJECT") {
        const rejected = await tx.defectReport.update({
          where: { id: report.id },
          data: {
            status: "REJECTED",
            notes: reviewNotes,
            reviewedById: session.user.id,
            reviewedAt: new Date(),
          },
        });

        await tx.activityLog.create({
          data: {
            action: "DEFECT_REJECTED",
            entityType: "DefectReport",
            entityId: report.id,
            userId: session.user.id,
            details: {
              reportNumber: report.reportNumber,
            } as Prisma.InputJsonValue,
          },
        });

        return rejected;
      }

      const sourceLocationId = report.fromLocationId ?? report.machine?.locationId;
      if (!sourceLocationId) {
        throw new Error("Defect report has no source location to deduct stock from.");
      }

      for (const item of report.items) {
        const existing = await tx.stockLevel.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: sourceLocationId,
            },
          },
          select: { id: true, quantity: true },
        });

        const previousQty = existing?.quantity ?? 0;
        const nextQty = previousQty - item.quantity;

        const stockLevel = await tx.stockLevel.upsert({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: sourceLocationId,
            },
          },
          update: { quantity: nextQty },
          create: {
            productId: item.productId,
            locationId: sourceLocationId,
            quantity: nextQty,
          },
        });

        await tx.activityLog.create({
          data: {
            action: "DEFECT_CONFIRMED",
            entityType: "DefectReport",
            entityId: report.id,
            userId: session.user.id,
            details: {
              reportNumber: report.reportNumber,
              defectItemId: item.id,
              productId: item.productId,
              locationId: sourceLocationId,
              beforeQty: previousQty,
              afterQty: nextQty,
            } as Prisma.InputJsonValue,
          },
        });

        if (!stockLevel.id) {
          throw new Error("Failed to update stock for defect item.");
        }
      }

      await tx.defectItem.updateMany({
        where: {
          defectReportId: report.id,
          faultType: "VENDOR",
        },
        data: {
          vendorCreditSuggested: true,
        },
      });

      const confirmed = await tx.defectReport.update({
        where: { id: report.id },
        data: {
          status: "CONFIRMED",
          notes: reviewNotes,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });

      return confirmed;
    });

    return NextResponse.json({
      data: result,
      message:
        parsed.data.action === "CONFIRM"
          ? "Defect report confirmed and stock deducted."
          : "Defect report rejected.",
    });
  } catch (error) {
    console.error("POST /api/defects/[id]/review failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to review defect report." },
      { status: 500 }
    );
  }
}
