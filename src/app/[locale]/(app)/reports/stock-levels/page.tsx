import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { CsvExportButton } from "@/components/CsvExportButton";
import { PdfExportButton } from "@/components/PdfExportButton";

export default async function StockLevelsReportPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "ReportsStockLevels" });

  const levels = await prisma.stockLevel.findMany({
    include: {
      product: {
        select: {
          compoundId: true,
          name: true,
          minStock: true,
          index: { select: { name: true } },
        },
      },
      location: { select: { name: true } },
    },
    orderBy: [{ product: { compoundId: "asc" } }, { location: { name: "asc" } }],
    take: 500,
  });

  const csvHeaders = [
    t("columns.compoundId"),
    t("columns.product"),
    t("columns.index"),
    t("columns.location"),
    t("columns.qty"),
    t("columns.min"),
  ];

  const csvRows = levels.map((entry) => [
    entry.product.compoundId,
    entry.product.name,
    entry.product.index.name,
    entry.location.name,
    entry.quantity,
    entry.product.minStock,
  ]);

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("subtitle")}</p>
          </div>
          <div className="flex gap-3">
            <CsvExportButton
              filename={`stock-levels-${new Date().toISOString().slice(0, 10)}.csv`}
              headers={csvHeaders}
              rows={csvRows}
            />
            <PdfExportButton
              filename={`stock-levels-${new Date().toISOString().slice(0, 10)}.pdf`}
              title={t("title")}
              headers={csvHeaders}
              rows={csvRows}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("columns.compoundId")}</th>
                  <th className="px-4 py-3">{t("columns.product")}</th>
                  <th className="px-4 py-3">{t("columns.index")}</th>
                  <th className="px-4 py-3">{t("columns.location")}</th>
                  <th className="px-4 py-3">{t("columns.qty")}</th>
                  <th className="px-4 py-3">{t("columns.min")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {levels.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">{entry.product.compoundId}</td>
                    <td className="px-4 py-3">{entry.product.name}</td>
                    <td className="px-4 py-3">{entry.product.index.name}</td>
                    <td className="px-4 py-3">{entry.location.name}</td>
                    <td className="px-4 py-3">{entry.quantity}</td>
                    <td className="px-4 py-3">{entry.product.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
