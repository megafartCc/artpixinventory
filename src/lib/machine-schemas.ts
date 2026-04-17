import { MachineType } from "@prisma/client";
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

export const machineMutationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(191),
  type: z.nativeEnum(MachineType),
  locationId: z.string().trim().min(1, "Assigned sublocation is required"),
  erpixMachineId: z.preprocess(
    emptyToNull,
    z.string().trim().max(191).nullable()
  ),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
  active: z.boolean().default(true),
});

export type MachineMutationInput = z.infer<typeof machineMutationSchema>;
