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

export const countSessionCreateSchema = z.object({
  name: z.string().trim().min(1, "Count name is required."),
  locationId: z.string().trim().min(1, "Location is required."),
  type: z.enum(["FULL", "CYCLE", "SPOT"]),
  assignedToId: z.preprocess(emptyToNull, z.string().trim().nullable()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
});

export const countEntrySchema = z.object({
  scanValue: z.string().trim().min(1, "A product barcode or compound ID is required."),
  countedQty: z.coerce.number().int().nonnegative(),
  notes: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
});

export const countSessionActionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "CANCEL"]),
});
