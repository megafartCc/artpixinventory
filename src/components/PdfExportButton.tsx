"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PdfExportButtonProps = {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

export function PdfExportButton({
  filename,
  title,
  headers,
  rows,
}: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Load Cyrillic font
      try {
        const fontUrl = "/fonts/Roboto-Regular.ttf";
        const response = await fetch(fontUrl);
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
      } catch (fontError) {
        console.warn("Could not load Cyrillic font, falling back to default", fontError);
      }

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
    } catch (error) {
      console.error("PDF export failed", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={() => void handleExport()}
      disabled={exporting}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      Export PDF
    </button>
  );
}
