import { AdjustmentReason } from "@prisma/client";
import { z } from "zod";

const stockAdjustmentReasons = [
  AdjustmentReason.COUNT_VARIANCE,
  AdjustmentReason.DAMAGE,
  AdjustmentReason.LOSS,
  AdjustmentReason.FOUND,
  AdjustmentReason.CORRECTION,
  AdjustmentReason.OTHER,
] as const;

const emptyToNull = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  return value;
};

export const stockAdjustmentSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  locationId: z.string().trim().min(1, "Location is required."),
  newQty: z.coerce.number().int(),
  reason: z.enum(stockAdjustmentReasons),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
});

export const stockAdjustmentReasonOptions = stockAdjustmentReasons;
