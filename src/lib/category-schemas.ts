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

export const categoryMutationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(191),
  description: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000).nullable()
  ),
  parentId: z.preprocess(emptyToNull, z.string().trim().nullable()),
  active: z.boolean().default(true),
});

export type CategoryMutationInput = z.infer<typeof categoryMutationSchema>;
