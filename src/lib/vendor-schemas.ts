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

export const vendorMutationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(191),
  contactName: z.preprocess(emptyToNull, z.string().trim().max(191).nullable()),
  email: z.preprocess(emptyToNull, z.string().trim().email().max(191).nullable()),
  phone: z.preprocess(emptyToNull, z.string().trim().max(191).nullable()),
  address: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
  country: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  paymentTerms: z.preprocess(emptyToNull, z.string().trim().max(191).nullable()),
  defaultLeadTimeDays: nullableInteger,
  enableContainerConstraints: z.boolean().default(false),
  containerTemplateId: z.preprocess(emptyToNull, z.string().trim().nullable()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  active: z.boolean().default(true),
});
