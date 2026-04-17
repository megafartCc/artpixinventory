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

const nullableInteger = z.preprocess(
  emptyToNull,
  z.coerce.number().int().nonnegative().nullable()
);

const nullableDecimal = z.preprocess(
  emptyToNull,
  z.coerce.number().finite().nonnegative().nullable()
);

export const purchaseOrderItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  orderedQty: z.coerce.number().int().positive("Quantity must be at least 1."),
  unitCost: z.coerce.number().finite().nonnegative(),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
});

export const purchaseOrderMutationSchema = z.object({
  vendorId: z.string().trim().min(1, "Vendor is required."),
  vendorOrderId: z.preprocess(emptyToNull, z.string().trim().max(191).nullable()),
  orderDate: z.string().trim().min(1, "Order date is required."),
  leadTimeDays: nullableInteger,
  containerTemplateId: z.preprocess(
    emptyToNull,
    z.string().trim().max(191).nullable()
  ),
  shippingCost: z.coerce.number().finite().nonnegative(),
  otherCosts: z.coerce.number().finite().nonnegative(),
  notes: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable()),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, "Add at least one PO item.")
    .transform((items) => {
      const deduped = new Map<string, z.infer<typeof purchaseOrderItemSchema>>();
      for (const item of items) {
        deduped.set(item.productId, item);
      }
      return Array.from(deduped.values());
    }),
  submitForApproval: z.boolean().default(false),
});

export const purchaseOrderStatusSchema = z.object({
  action: z.enum([
    "SUBMIT",
    "APPROVE",
    "REJECT",
    "MARK_ORDERED",
    "CANCEL",
  ]),
});

export const purchaseOrderDocumentSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(64),
  fileName: z.string().trim().min(1, "File name is required.").max(255),
  fileUrl: z
    .string()
    .trim()
    .min(1, "File content is required.")
    .max(2_000_000),
  fileSize: nullableDecimal,
});

export type PurchaseOrderMutationInput = z.infer<
  typeof purchaseOrderMutationSchema
>;
