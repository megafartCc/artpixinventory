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

export const productVendorMutationSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  isDefault: z.boolean().default(false),
  moq: nullableInteger,
  unitCost: nullableDecimal,
  leadTimeDays: nullableInteger,
  vendorSku: z.preprocess(emptyToNull, z.string().trim().max(191).nullable()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
});
