import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Loads the Roboto font for Cyrillic support in jsPDF.
 * This is meant to be used on the client side.
 */
export async function loadRobotoFont(doc: jsPDF) {
  try {
    const response = await fetch("/fonts/Roboto-Regular.ttf");
    if (!response.ok) throw new Error("Font not found");
    
    const fontBlob = await response.blob();
    const reader = new FileReader();
    
    const base64Font = await new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(fontBlob);
    });

    doc.addFileToVFS("Roboto-Regular.ttf", base64Font);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.setFont("Roboto");
    return true;
  } catch (error) {
    console.warn("Could not load Cyrillic font", error);
    return false;
  }
}

/**
 * Standard PDF table generation with Cyrillic support.
 */
export async function generateTablePdf({
  filename,
  title,
  headers,
  rows,
  orientation = "landscape",
}: {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  orientation?: "portrait" | "landscape";
}) {
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  await loadRobotoFont(doc);

  // Title
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Date: ${new Date().toLocaleString()}`, 14, 30);

  // Table
  autoTable(doc, {
    startY: 35,
    head: [headers],
    body: rows,
    styles: {
      font: "Roboto",
      fontStyle: "normal",
    },
    headStyles: {
      fillColor: [51, 65, 85], // slate-700
      textColor: 255,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    margin: { top: 35 },
  });

  doc.save(filename);
}
