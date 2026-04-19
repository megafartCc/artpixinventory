"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Package2 } from "lucide-react";
import { PdfExportButton } from "@/components/PdfExportButton";

export function TransfersClient({
  locale,
  transfers,
}: {
  locale: string;
  transfers: Array<{
    id: string;
    reference: string;
    status: string;
    createdBy: string;
    startedAt: string;
    completedAt: string;
    itemsCount: number;
  }>;
}) {
  const t = useTranslations("Transfers");

  return (
    <div className="p-6 lg:p-8">
      <div className="w-full space-y-10">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
                {t("title")}
              </h1>
              <p className="mt-2 text-lg text-slate-500">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PdfExportButton
                filename={`transfers_${new Date().toISOString().slice(0, 10)}.pdf`}
                title="Transfers Log"
                headers={["Reference", "Status", "Created By", "Started", "Items", "Completed"]}
                rows={transfers.map((t) => [
                  t.reference,
                  t.status,
                  t.createdBy,
                  t.startedAt,
                  t.itemsCount,
                  t.completedAt,
                ])}
              />
              <Link
                href={`/${locale}/transfers/new`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
              >
                <ArrowLeftRight className="h-4 w-4" />
                {t("newTransfer")}
              </Link>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-8 py-4">{t("columns.reference")}</th>
                  <th className="px-8 py-4">{t("columns.status")}</th>
                  <th className="px-8 py-4">{t("columns.createdBy")}</th>
                  <th className="px-8 py-4">{t("columns.started")}</th>
                  <th className="px-8 py-4 text-center">{t("columns.itemsCount")}</th>
                  <th className="px-8 py-4">{t("columns.completed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center font-medium text-slate-400">
                      {t("noTransfers")}
                    </td>
                  </tr>
                ) : (
                  transfers.map((transfer) => (
                    <tr key={transfer.id} className="transition hover:bg-slate-50/50">
                      <td className="px-8 py-5">
                        <Link
                          href={`/${locale}/transfers/${transfer.id}`}
                          className="font-black text-slate-950 hover:underline decoration-slate-300 underline-offset-4"
                        >
                          {transfer.reference}
                        </Link>
                      </td>
                      <td className="px-8 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusTone(
                            transfer.status
                          )}`}
                        >
                          {t(`status.${transfer.status}`)}
                        </span>
                      </td>
                      <td className="px-8 py-5 font-medium text-slate-500">{transfer.createdBy}</td>
                      <td className="px-8 py-5 text-slate-500">{transfer.startedAt}</td>
                      <td className="px-8 py-5 text-center font-bold text-slate-950">
                        <div className="flex items-center justify-center gap-2">
                          <Package2 className="h-3.5 w-3.5 text-slate-400" />
                          {transfer.itemsCount}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-slate-500">{transfer.completedAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
);
}

function statusTone(status: string) {
switch (status) {
  case "COLLECTING":
    return "bg-sky-100 text-sky-700";
  case "DROPPING":
    return "bg-amber-100 text-amber-700";
  case "COMPLETED":
    return "bg-emerald-100 text-emerald-700";
  case "CANCELLED":
    return "bg-slate-200 text-slate-600";
  default:
    return "bg-slate-100 text-slate-700";
}
}
