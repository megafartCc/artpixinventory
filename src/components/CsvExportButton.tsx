"use client";

import { Download } from "lucide-react";

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export function CsvExportButton({
  filename,
  headers,
  rows,
  label = "Export CSV",
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  label?: string;
}) {
  const handleExport = () => {
    const csv = buildCsv(headers, rows);
    downloadCsv(filename, csv);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
