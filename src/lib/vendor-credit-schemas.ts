import { CreditStatus, VendorCreditReason } from "@prisma/client";
import { z } from "zod";

const emptyToNull = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

export const vendorCreditCreateSchema = z.object({
  vendorId: z.string().trim().min(1),
  purchaseOrderId: z.preprocess(emptyToNull, z.string().trim().min(1).nullable()),
  reason: z.nativeEnum(VendorCreditReason),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.coerce.number().int().positive(),
        unitCost: z.coerce.number().positive(),
        notes: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
      })
    )
    .min(1),
});

export const vendorCreditStatusSchema = z.object({
  status: z.nativeEnum(CreditStatus),
});
