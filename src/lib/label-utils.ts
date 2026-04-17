import { generateNextReference } from "@/lib/inventory-utils";

export async function generateNextPalletNumber(
  findLatest: (prefix: string) => Promise<string | null>
) {
  return generateNextReference(findLatest, "PAL");
}

export function buildPalletZpl(input: {
  palletNumber: string;
  lines: string[];
}) {
  const textLines = input.lines.slice(0, 5);
  const body = [
    "^XA",
    "^PW600",
    "^LL400",
    "^FO40,30^A0N,40,40^FDArtPix 3D^FS",
    `^FO40,90^A0N,34,34^FD${input.palletNumber}^FS`,
    `^FO40,140^BQN,2,8^FDLA,${input.palletNumber}^FS`,
    ...textLines.map(
      (line, index) => `^FO280,${150 + index * 32}^A0N,26,26^FD${line.replace(/[^\x20-\x7E]/g, "?")}^FS`
    ),
    "^XZ",
  ];

  return body.join("\n");
}
