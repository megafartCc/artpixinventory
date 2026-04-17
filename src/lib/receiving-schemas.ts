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

export const receivingCompleteSchema = z.object({
  purchaseOrderId: z.string().trim().min(1, "Purchase order is required."),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  items: z
    .array(
      z.object({
        poItemId: z.string().trim().min(1),
        receiveQty: z.coerce.number().int().nonnegative(),
        damagedQty: z.coerce.number().int().nonnegative(),
        notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
      })
    )
    .min(1, "At least one receiving item is required."),
});

export const palletCreateSchema = z.object({
  receivingSessionId: z.string().trim().min(1, "Receiving session is required."),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .min(1, "Add at least one pallet item."),
});

export const palletPlaceSchema = z.object({
  palletNumber: z.string().trim().min(1, "Pallet QR is required."),
  locationQrCode: z.string().trim().min(1, "Location QR is required."),
});
