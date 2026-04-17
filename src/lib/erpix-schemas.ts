import { FaultType, MachineType } from "@prisma/client";
import { z } from "zod";

const emptyToNull = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  return value;
};

export const erpixConsumeSchema = z.object({
  erpixMachineId: z.string().trim().min(1),
  compoundId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
  erpixOrderId: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  operatorName: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  defect: z
    .object({
      erpixReasonId: z.string().trim().min(1),
      isDefective: z.boolean(),
    })
    .optional(),
});

export const erpixReserveSchema = z.object({
  compoundId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
  erpixOrderId: z.string().trim().min(1),
});

export const erpixSyncMachinesSchema = z.array(
  z.object({
    name: z.string().trim().min(1),
    type: z.nativeEnum(MachineType),
    erpixMachineId: z.string().trim().min(1),
  })
);

export const erpixSyncDefectReasonsSchema = z.array(
  z.object({
    erpixReasonId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    faultType: z.nativeEnum(FaultType),
  })
);

export const erpixSyncProductsSchema = z.array(
  z.object({
    erpixId: z.string().trim().min(1),
    imageUrl: z.preprocess(emptyToNull, z.string().url().nullable()),
    weight: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()),
    length: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()),
    width: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()),
    height: z.preprocess(emptyToNull, z.coerce.number().positive().nullable()),
  })
);
