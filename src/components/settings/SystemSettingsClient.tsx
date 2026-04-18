"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";

type SettingsMap = Record<string, string>;

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function SystemSettingsClient({
  initialValues,
  locationOptions,
  erpixApiKeyMasked,
}: {
  initialValues: SettingsMap;
  locationOptions: Array<{ id: string; name: string }>;
  erpixApiKeyMasked: string;
}) {
  const t = useTranslations("Settings");
  const tc = useTranslations("CommonExtended");
  const router = useRouter();
  const [form, setForm] = useState<SettingsMap>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  useToastFeedback(error, feedback);

  const save = async () => {
    setSaving(true);
    setError("");
    setFeedback("");

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.saveFailed"));
      return;
    }

    setFeedback(payload.message ?? t("saved"));
    router.refresh();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{t("systemTitle")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("systemSubtitle")}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{t("defaultReceivingLocation")}</span>
          <select
            className={inputClassName}
            value={form.default_receiving_location ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, default_receiving_location: event.target.value }))}
          >
            <option value="">{t("selectLocation")}</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{t("poPrefix")}</span>
          <input
            className={inputClassName}
            value={form.po_number_prefix ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, po_number_prefix: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{t("slackInventory")}</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_inventory_alerts ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_inventory_alerts: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{t("slackPurchasing")}</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_purchasing ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_purchasing: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{t("slackQuality")}</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_quality ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_quality: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{t("slackWarehouseOps")}</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_warehouse_ops ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_warehouse_ops: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
          <span className="font-medium text-slate-700">{t("slackSystemErrors")}</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_system_errors ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_system_errors: event.target.value }))}
          />
        </label>

        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-600">{t("erpixMasked")}</p>
          <p className="mt-1 font-mono text-xs text-slate-800">{erpixApiKeyMasked}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? tc("saving") : t("saveSettings")}
        </button>
      </div>
    </section>
  );
}
