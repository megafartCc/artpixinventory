import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageDefects } from "@/lib/permissions";
import { defectReportCreateSchema } from "@/lib/defect-schemas";
import { generateNextReference } from "@/lib/inventory-utils";
import { sendSlackNotification } from "@/lib/slack";

export async function GET() {
  const defects = await prisma.defectReport.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      machine: { select: { name: true } },
      fromLocation: { select: { name: true } },
      items: {
        include: {
          product: { select: { compoundId: true, name: true } },
          reason: { select: { name: true, faultType: true } },
        },
      },
    },
  });

  return NextResponse.json({ data: defects });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageDefects(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = defectReportCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid defect report payload." },
      { status: 400 }
    );
  }

  try {
    const report = await prisma.$transaction(async (tx) => {
      const sourceMachine = parsed.data.machineId
        ? await tx.machine.findUnique({
            where: { id: parsed.data.machineId },
            select: { id: true, locationId: true },
          })
        : null;

      if (parsed.data.machineId && !sourceMachine) {
        throw new Error("Machine not found.");
      }

      const sourceLocationId = parsed.data.fromLocationId ?? sourceMachine?.locationId ?? null;

      if (!sourceLocationId) {
        throw new Error("A source location is required to report defects.");
      }

      const [sourceLocation, products, reasons] = await Promise.all([
        tx.location.findUnique({ where: { id: sourceLocationId }, select: { id: true } }),
        tx.product.findMany({
          where: {
            id: { in: parsed.data.items.map((item) => item.productId) },
            active: true,
          },
          select: { id: true },
        }),
        tx.defectReason.findMany({
          where: {
            id: { in: parsed.data.items.map((item) => item.reasonId) },
            active: true,
          },
          select: { id: true, faultType: true },
        }),
      ]);

      if (!sourceLocation?.id) {
        throw new Error("Source location not found.");
      }

      if (products.length !== new Set(parsed.data.items.map((item) => item.productId)).size) {
        throw new Error("One or more products are invalid or inactive.");
      }

      if (reasons.length !== new Set(parsed.data.items.map((item) => item.reasonId)).size) {
        throw new Error("One or more defect reasons are invalid or inactive.");
      }

      const reasonMap = new Map(reasons.map((reason) => [reason.id, reason]));

      const reportNumber = await generateNextReference(async (prefix) => {
        const latest = await tx.defectReport.findFirst({
          where: { reportNumber: { startsWith: prefix } },
          orderBy: { reportNumber: "desc" },
          select: { reportNumber: true },
        });

        return latest?.reportNumber ?? null;
      }, "DEF");

      const createdReport = await tx.defectReport.create({
        data: {
          reportNumber,
          source: parsed.data.source,
          machineId: parsed.data.machineId,
          fromLocationId: sourceLocationId,
          locationId: parsed.data.locationId,
          erpixOrderId: parsed.data.erpixOrderId,
          operatorName: parsed.data.operatorName,
          notes: parsed.data.notes,
          createdById: session.user.id,
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              reasonId: item.reasonId,
              quantity: item.quantity,
              faultType: reasonMap.get(item.reasonId)?.faultType ?? "INTERNAL",
              notes: item.notes,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      await tx.activityLog.create({
        data: {
          action: "DEFECT_REPORTED",
          entityType: "DefectReport",
          entityId: createdReport.id,
          userId: session.user.id,
          details: {
            reportNumber: createdReport.reportNumber,
            source: createdReport.source,
            fromLocationId: createdReport.fromLocationId,
            items: createdReport.items.map((item) => ({
              productId: item.productId,
              reasonId: item.reasonId,
              quantity: item.quantity,
            })),
          } as Prisma.InputJsonValue,
        },
      });

      return createdReport;
    });

    await sendSlackNotification({
      type: "DEFECT_REPORTED",
      channel: "#quality",
      message: `Defect report ${report.reportNumber} submitted for review (${report.items.length} item(s)).`,
      entityType: "DefectReport",
      entityId: report.id,
    });

    return NextResponse.json({ data: report, message: "Defect report submitted for review." });
  } catch (error) {
    console.error("POST /api/defects failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create defect report." },
      { status: 500 }
    );
  }
}
