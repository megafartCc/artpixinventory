import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createActivityLog, generateNextReference } from "@/lib/inventory-utils";
import { validateErpixApiKey, withErpixRetry } from "@/lib/erpix-client";
import { erpixConsumeSchema } from "@/lib/erpix-schemas";

export async function POST(request: Request) {
  const authError = validateErpixApiKey(request);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const parsed = erpixConsumeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid ERPIX consume payload." },
      { status: 400 }
    );
  }

  try {
    const result = await withErpixRetry(
      async () => {
        return prisma.$transaction(async (tx) => {
          const machine = await tx.machine.findFirst({
            where: {
              erpixMachineId: parsed.data.erpixMachineId,
              active: true,
            },
            select: { id: true, locationId: true, name: true },
          });

          if (!machine) {
            throw new Error("Machine not found for given ERPIX machine ID.");
          }

          const product = await tx.product.findFirst({
            where: {
              compoundId: parsed.data.compoundId,
              active: true,
            },
            select: { id: true, compoundId: true, name: true },
          });

          if (!product) {
            throw new Error("Product not found for given compound ID.");
          }

          const existingStock = await tx.stockLevel.findUnique({
            where: {
              productId_locationId: {
                productId: product.id,
                locationId: machine.locationId,
              },
            },
            select: { id: true, quantity: true },
          });

          const previousQty = existingStock?.quantity ?? 0;
          const nextQty = previousQty - parsed.data.quantity;

          const stockLevel = await tx.stockLevel.upsert({
            where: {
              productId_locationId: {
                productId: product.id,
                locationId: machine.locationId,
              },
            },
            update: {
              quantity: nextQty,
            },
            create: {
              productId: product.id,
              locationId: machine.locationId,
              quantity: nextQty,
            },
          });

          const isCorrectLocation = previousQty > 0;

          const consumption = await tx.machineConsumption.create({
            data: {
              machineId: machine.id,
              productId: product.id,
              quantity: parsed.data.quantity,
              expectedLocationId: machine.locationId,
              isCorrectLocation,
              erpixOrderId: parsed.data.erpixOrderId,
              operatorName: parsed.data.operatorName,
              notificationSent: !isCorrectLocation,
            },
          });

          let defectReportId: string | null = null;

          if (parsed.data.defect?.isDefective) {
            const reason = await tx.defectReason.findFirst({
              where: {
                erpixReasonId: parsed.data.defect.erpixReasonId,
                active: true,
              },
              select: { id: true, faultType: true },
            });

            if (!reason) {
              throw new Error("Defect reason is not mapped for ERPIX reason ID.");
            }

            const reportNumber = await generateNextReference(async (prefix) => {
              const latest = await tx.defectReport.findFirst({
                where: { reportNumber: { startsWith: prefix } },
                orderBy: { reportNumber: "desc" },
                select: { reportNumber: true },
              });

              return latest?.reportNumber ?? null;
            }, "DEF");

            const defectReport = await tx.defectReport.create({
              data: {
                reportNumber,
                source: "PRODUCTION",
                machineId: machine.id,
                fromLocationId: machine.locationId,
                status: "CONFIRMED",
                erpixOrderId: parsed.data.erpixOrderId,
                operatorName: parsed.data.operatorName,
                notes: "Auto-created from ERPIX consume endpoint.",
                createdById: (await systemUserId(tx)),
                reviewedById: (await systemUserId(tx)),
                reviewedAt: new Date(),
                items: {
                  create: {
                    productId: product.id,
                    reasonId: reason.id,
                    quantity: parsed.data.quantity,
                    faultType: reason.faultType,
                    vendorCreditSuggested: reason.faultType === "VENDOR",
                    notes: "Auto-confirmed from ERPIX.",
                  },
                },
              },
              select: { id: true },
            });

            defectReportId = defectReport.id;
          }

          await createActivityLog(tx, {
            action: "ERPIX_CONSUME",
            entityType: "MachineConsumption",
            entityId: consumption.id,
            details: {
              machineId: machine.id,
              machineName: machine.name,
              productId: product.id,
              compoundId: product.compoundId,
              quantity: parsed.data.quantity,
              beforeQty: previousQty,
              afterQty: stockLevel.quantity,
              isCorrectLocation,
              defectReportId,
            } as Prisma.InputJsonValue,
          });

          return {
            consumptionId: consumption.id,
            machineId: machine.id,
            productId: product.id,
            isCorrectLocation,
            defectReportId,
          };
        });
      },
      {
        retries: 3,
        delayMs: 10_000,
        onFinalFailure: async (error) => {
          console.error("ERPIX consume final failure", error);
        },
      }
    );

    return NextResponse.json({ data: result, message: "ERPIX consume processed." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process ERPIX consume." },
      { status: 500 }
    );
  }
}

async function systemUserId(tx: Prisma.TransactionClient) {
  const fallbackUser = await tx.user.findFirst({
    where: { email: "admin@artpix3d.com" },
    select: { id: true },
  });

  if (fallbackUser?.id) {
    return fallbackUser.id;
  }

  const anyUser = await tx.user.findFirst({ select: { id: true } });
  if (!anyUser?.id) {
    throw new Error("No user available for system-created ERPIX records.");
  }

  return anyUser.id;
}
