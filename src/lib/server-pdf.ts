import fs from "fs";
import path from "path";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

let cachedFontBase64: string | null = null;

/**
 * Creates a jsPDF instance with Roboto font pre-loaded for Cyrillic support.
 */
export function createCyrillicPdf() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  try {
    if (!cachedFontBase64) {
      const fontPath = path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf");
      if (fs.existsSync(fontPath)) {
        cachedFontBase64 = fs.readFileSync(fontPath, { encoding: "base64" });
      }
    }

    if (cachedFontBase64) {
      doc.addFileToVFS("Roboto-Regular.ttf", cachedFontBase64);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.setFont("Roboto");
    }
  } catch (error) {
    console.warn("Failed to load Cyrillic font for server-side PDF", error);
  }

  return doc;
}

export { autoTable };
