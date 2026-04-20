"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ActivityTimeline } from "@/components/ActivityTimeline";

export function TransferDetailClient({
  locale,
  transfer,
}: {
  locale: string;
  transfer: {
    id: string;
    reference: string;
    status: string;
    createdBy: string;
    startedAt: string;
    completedAt: string;
    picks: Array<{
      id: string;
      compoundId: string;
      productName: string;
      locationName: string;
      quantity: number;
      timestamp: string;
    }>;
    drops: Array<{
      id: string;
      compoundId: string;
      productName: string;
      locationName: string;
      quantity: number;
      timestamp: string;
    }>;
  };
}) {
  const t = useTranslations("TransferDetail");

  return (
    <div className="p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div>
          <Link
            href={`/${locale}/transfers`}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {t("back")}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">{transfer.reference}</h1>
          <p className="mt-1 text-slate-500">
            {transfer.status} • {transfer.createdBy} • {transfer.startedAt}
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("picks")}</h2>
            <div className="mt-5 space-y-3">
              {transfer.picks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  {t("noPicks")}
                </div>
              ) : (
                transfer.picks.map((pick) => (
                  <div key={pick.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <p className="font-semibold text-slate-900">{pick.compoundId}</p>
                    <p className="text-sm text-slate-500">
                      {pick.productName} • {pick.quantity} • {pick.locationName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{pick.timestamp}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("drops")}</h2>
            <div className="mt-5 space-y-3">
              {transfer.drops.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  {t("noDrops")}
                </div>
              ) : (
                transfer.drops.map((drop) => (
                  <div key={drop.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <p className="font-semibold text-slate-900">{drop.compoundId}</p>
                    <p className="text-sm text-slate-500">
                      {drop.productName} • {drop.quantity} • {drop.locationName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{drop.timestamp}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">{t("activityHistory")}</h2>
          <ActivityTimeline entityType="Transfer" entityId={transfer.id} />
        </section>
      </div>
    </div>
  );
}
