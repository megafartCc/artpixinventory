import { sanitizeCode128, sanitizeQrValue } from "@/lib/barcode";

export function buildProductLabelZpl(input: {
  compoundId: string;
  productName: string;
}) {
  const compoundId = sanitizeCode128(input.compoundId);
  const productName = sanitizeCode128(input.productName);

  return [
    "^XA",
    "^PW600",
    "^LL300",
    "^FO30,30^A0N,40,40^FD" + compoundId + "^FS",
    "^FO30,85^BY3,2,90^BCN,90,Y,N,N^FD" + compoundId + "^FS",
    "^FO30,200^A0N,28,28^FD" + productName.slice(0, 32) + "^FS",
    "^XZ",
  ].join("\n");
}

export function buildLocationLabelZpl(input: {
  qrCode: string;
  locationName: string;
  locationType: string;
}) {
  const qrCode = sanitizeQrValue(input.qrCode);
  const locationName = sanitizeCode128(input.locationName);
  const locationType = sanitizeCode128(input.locationType);

  return [
    "^XA",
    "^PW600",
    "^LL380",
    "^FO40,35^BQN,2,7^FDLA," + qrCode + "^FS",
    "^FO260,70^A0N,34,34^FD" + locationName.slice(0, 24) + "^FS",
    "^FO260,120^A0N,26,26^FD" + locationType.slice(0, 22) + "^FS",
    "^FO260,170^A0N,28,28^FD" + qrCode.slice(0, 28) + "^FS",
    "^XZ",
  ].join("\n");
}

export function buildPalletLabelZpl(input: {
  palletNumber: string;
  palletId: string;
}) {
  const palletNumber = sanitizeCode128(input.palletNumber);
  const palletId = sanitizeCode128(input.palletId);

  return [
    "^XA",
    "^PW600",
    "^LL320",
    "^FO40,35^BQN,2,7^FDLA," + palletNumber + "^FS",
    "^FO260,70^A0N,40,40^FD" + palletNumber + "^FS",
    "^FO260,130^A0N,28,28^FDID: " + palletId.slice(0, 24) + "^FS",
    "^XZ",
  ].join("\n");
}
