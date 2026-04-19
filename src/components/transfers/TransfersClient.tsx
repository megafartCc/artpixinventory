"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

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
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href={`/${locale}/transfers/new`}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t("newTransfer")}
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("columns.reference")}</th>
                  <th className="px-4 py-3">{t("columns.status")}</th>
                  <th className="px-4 py-3">{t("columns.createdBy")}</th>
                  <th className="px-4 py-3">{t("columns.started")}</th>
                  <th className="px-4 py-3">{t("columns.itemsCount")}</th>
                  <th className="px-4 py-3">{t("columns.completed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                      {t("noTransfers")}
                    </td>
                  </tr>
                ) : (
                  transfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        <Link href={`/${locale}/transfers/${transfer.id}`}>
                          {transfer.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(transfer.status)}`}>
                          {t(`status.${transfer.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-4">{transfer.createdBy}</td>
                      <td className="px-4 py-4">{transfer.startedAt}</td>
                      <td className="px-4 py-4">{transfer.itemsCount}</td>
                      <td className="px-4 py-4">{transfer.completedAt}</td>
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
