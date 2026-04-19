import { z } from "zod";

export const productUnits = ["pcs", "box", "ltr", "kg", "set"] as const;

const emptyToNull = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  return value;
};

const nullableNumber = z.preprocess(
  emptyToNull,
  z.coerce.number().finite().nonnegative().nullable()
);

const nullableInteger = z.preprocess(
  emptyToNull,
  z.coerce.number().int().nonnegative().nullable()
);

export const productMutationSchema = z.object({
  compoundId: z
    .string()
    .trim()
    .min(1, "Compound ID is required")
    .max(64)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Name is required").max(191),
  indexId: z.string().trim().min(1, "Index is required"),
  uom: z.enum(productUnits),
  barcode: z.preprocess(emptyToNull, z.string().trim().max(191).nullable()),
  minStock: z.coerce.number().int().nonnegative(),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  packagingImageUrl: z.preprocess(
    emptyToNull,
    z.string().trim().max(2000).nullable()
  ),
  categories: z
    .array(z.string().trim().min(1).max(100))
    .default([])
    .transform((values) =>
      Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean))
      )
    ),
  length: nullableNumber,
  width: nullableNumber,
  height: nullableNumber,
  weight: nullableNumber,
  itemsPerBox: nullableInteger,
  boxesPerPallet: nullableInteger,
  itemWeight: nullableNumber,
  dimensionUnit: z.string().trim().max(24).default("in"),
  weightUnit: z.string().trim().max(24).default("lb"),
  active: z.boolean().optional(),
});

export type ProductMutationInput = z.infer<typeof productMutationSchema>;
