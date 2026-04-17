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

export const transferStartSchema = z.object({
  reference: z.preprocess(emptyToNull, z.string().trim().max(64).nullable()),
});

export const transferCollectSchema = z.object({
  locationQrCode: z.string().trim().min(1, "Location QR is required."),
  productId: z.string().trim().min(1, "Product is required."),
  quantity: z.coerce.number().int().positive(),
});

export const transferDropSchema = z.object({
  locationQrCode: z.string().trim().min(1, "Destination QR is required."),
  productId: z.string().trim().min(1, "Product is required."),
  quantity: z.coerce.number().int().positive(),
});

export const transferStatusSchema = z.object({
  action: z.enum(["START_DROPOFF", "CANCEL"]),
});
