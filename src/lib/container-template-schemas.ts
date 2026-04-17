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

const decimalNumber = z.coerce.number().finite().nonnegative();

export const containerTemplateMutationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(191),
  maxWeightKg: decimalNumber,
  maxPallets: z.coerce.number().int().nonnegative(),
  maxLooseBoxes: z.coerce.number().int().nonnegative(),
  description: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000).nullable()
  ),
  active: z.boolean().default(true),
});
