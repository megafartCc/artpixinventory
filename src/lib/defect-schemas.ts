import { FaultType } from "@prisma/client";
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

export const defectReasonSchema = z.object({
  name: z.string().trim().min(2, "Reason name is required.").max(120),
  faultType: z.nativeEnum(FaultType),
});

export const defectReportItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  reasonId: z.string().trim().min(1, "Reason is required."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
  notes: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
});

export const defectReportCreateSchema = z
  .object({
    source: z.enum(["PRE_PRODUCTION", "PRODUCTION"]),
    machineId: z.preprocess(emptyToNull, z.string().trim().min(1).nullable()),
    fromLocationId: z.preprocess(emptyToNull, z.string().trim().min(1).nullable()),
    locationId: z.preprocess(emptyToNull, z.string().trim().min(1).nullable()),
    erpixOrderId: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
    operatorName: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
    notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
    items: z.array(defectReportItemSchema).min(1, "At least one item is required."),
  })
  .superRefine((input, ctx) => {
    if (input.source === "PRODUCTION" && !input.machineId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["machineId"],
        message: "Machine is required for production defects.",
      });
    }

    if (input.source === "PRE_PRODUCTION" && !input.fromLocationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromLocationId"],
        message: "From location is required for pre-production defects.",
      });
    }
  });

export const defectReviewSchema = z.object({
  action: z.enum(["CONFIRM", "REJECT"]),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
});
