import { unstable_noStore as noStore } from "next/cache";
import { POStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { CsvExportButton } from "@/components/CsvExportButton";
import { PdfExportButton } from "@/components/PdfExportButton";

function daysBetween(date: Date, from = new Date()) {
  return Math.floor((from.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function PoAgingReportPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "ReportsPoAging" });

  const openPoStatuses: POStatus[] = ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"];

  const orders = await prisma.purchaseOrder.findMany({
    where: { status: { in: openPoStatuses } },
    orderBy: { orderDate: "asc" },
  });

  const vendorIds = Array.from(new Set(orders.map((order) => order.vendorId)));
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));

  const rows = orders
    .map((order) => {
      const daysInStatus = daysBetween(order.updatedAt);
      const overdueDays = order.expectedDate ? Math.max(0, daysBetween(order.expectedDate)) : 0;
      return {
        id: order.id,
        poNumber: order.poNumber,
        vendorName: vendorById.get(order.vendorId) ?? order.vendorId,
        status: order.status,
        orderDate: order.orderDate.toISOString().slice(0, 10),
        expectedDate: order.expectedDate?.toISOString().slice(0, 10) ?? "-",
        daysInStatus,
        overdueDays,
      };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);

  const csvHeaders = [
    t("columns.po"),
    t("columns.vendor"),
    t("columns.status"),
    t("columns.orderDate"),
    t("columns.expectedDate"),
    t("columns.daysInStatus"),
    t("columns.overdue"),
  ];

  const csvRows = rows.map((row) => [
    row.poNumber,
    row.vendorName,
    row.status,
    row.orderDate,
    row.expectedDate,
    row.daysInStatus,
    row.overdueDays,
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
              filename={`po-aging-${new Date().toISOString().slice(0, 10)}.csv`}
              headers={csvHeaders}
              rows={csvRows}
            />
            <PdfExportButton
              filename={`po-aging-${new Date().toISOString().slice(0, 10)}.pdf`}
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
                  <th className="px-4 py-3">{t("columns.po")}</th>
                  <th className="px-4 py-3">{t("columns.vendor")}</th>
                  <th className="px-4 py-3">{t("columns.status")}</th>
                  <th className="px-4 py-3">{t("columns.orderDate")}</th>
                  <th className="px-4 py-3">{t("columns.expectedDate")}</th>
                  <th className="px-4 py-3">{t("columns.daysInStatus")}</th>
                  <th className="px-4 py-3">{t("columns.overdue")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">{row.poNumber}</td>
                    <td className="px-4 py-3">{row.vendorName}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.orderDate}</td>
                    <td className="px-4 py-3">{row.expectedDate}</td>
                    <td className="px-4 py-3">{row.daysInStatus}</td>
                    <td className={`px-4 py-3 font-medium ${row.overdueDays > 0 ? "text-red-600" : "text-slate-500"}`}>
                      {row.overdueDays}
                    </td>
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
