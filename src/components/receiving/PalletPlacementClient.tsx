"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function PalletPlacementClient({
  locale,
  pallets,
  locations,
}: {
  locale: string;
  pallets: Array<{
    id: string;
    palletNumber: string;
    status: string;
    items: Array<{
      compoundId: string;
      productName: string;
      quantity: number;
    }>;
  }>;
  locations: Array<{
    id: string;
    name: string;
    qrCode: string;
    type: string;
  }>;
}) {
  const t = useTranslations("PalletPlacement");
  const router = useRouter();
  const [palletNumber, setPalletNumber] = useState("");
  const [locationQrCode, setLocationQrCode] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(error, feedback);

  const selectedPallet = useMemo(
    () => pallets.find((pallet) => pallet.palletNumber === palletNumber) ?? null,
    [palletNumber, pallets]
  );
  const selectedLocation = useMemo(
    () => locations.find((location) => location.qrCode === locationQrCode) ?? null,
    [locationQrCode, locations]
  );

  const refresh = () => startTransition(() => router.refresh());

  const place = async () => {
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch("/api/pallets/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ palletNumber, locationQrCode }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("feedback.failed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.placed"));
    setPalletNumber("");
    setLocationQrCode("");
    refresh();
  };

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/${locale}/receiving`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              {t("back")}
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <Field label={t("scanPallet")}>
                <input
                  value={palletNumber}
                  onChange={(event) => setPalletNumber(event.target.value)}
                  placeholder="PAL-YYYY-NNNN"
                  className={inputClassName}
                  autoFocus
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {pallets.slice(0, 8).map((pallet) => (
                  <button
                    key={pallet.id}
                    onClick={() => setPalletNumber(pallet.palletNumber)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {pallet.palletNumber}
                  </button>
                ))}
              </div>

              <Field label={t("scanDestination")}>
                <input
                  value={locationQrCode}
                  onChange={(event) => setLocationQrCode(event.target.value)}
                  placeholder="LOC-..."
                  className={inputClassName}
                />
              </Field>
              <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                {locations
                  .filter((location) => !["WAREHOUSE", "RECEIVING"].includes(location.type))
                  .slice(0, 18)
                  .map((location) => (
                    <button
                      key={location.id}
                      onClick={() => setLocationQrCode(location.qrCode)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {location.name}
                    </button>
                  ))}
              </div>

              <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex flex-col sm:flex-row gap-3 z-50 lg:static lg:p-0 lg:border-none lg:bg-transparent lg:shadow-none lg:flex-row lg:justify-end">
                <button
                  onClick={() => void place()}
                  disabled={submitting || !palletNumber || !locationQrCode}
                  className="rounded-2xl bg-slate-900 px-4 py-4 text-base lg:py-2.5 lg:text-sm font-medium text-white disabled:opacity-60 flex-1 lg:flex-none"
                >
                  {t("place")}
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("palletId")}</h2>
              {!selectedPallet ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  {t("selectPallet")}
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedPallet.palletNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t("status")}: {selectedPallet.status}
                    </p>
                  </div>
                  {selectedPallet.items.map((item) => (
                    <div
                      key={`${selectedPallet.id}-${item.compoundId}`}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.compoundId}</p>
                      <p className="text-sm text-slate-500">
                        {item.productName} x{item.quantity}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("scanDestination")}</h2>
              {!selectedLocation ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  {t("scanDestination")}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedLocation.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedLocation.type} • {selectedLocation.qrCode}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
