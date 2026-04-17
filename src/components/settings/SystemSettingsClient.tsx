"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [form, setForm] = useState<SettingsMap>(initialValues);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSaving(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Failed to save settings.");
      return;
    }

    setMessage(payload.message ?? "Settings saved.");
    router.refresh();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">System Settings</h2>
      <p className="mt-1 text-sm text-slate-500">Admin-only configuration for receiving, numbering, Slack, and ERPIX.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Default receiving location</span>
          <select
            className={inputClassName}
            value={form.default_receiving_location ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, default_receiving_location: event.target.value }))}
          >
            <option value="">Select location</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">PO number prefix</span>
          <input
            className={inputClassName}
            value={form.po_number_prefix ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, po_number_prefix: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Slack #inventory-alerts webhook</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_inventory_alerts ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_inventory_alerts: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Slack #purchasing webhook</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_purchasing ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_purchasing: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Slack #quality webhook</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_quality ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_quality: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Slack #warehouse-ops webhook</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_warehouse_ops ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_warehouse_ops: event.target.value }))}
          />
        </label>

        <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
          <span className="font-medium text-slate-700">Slack #system-errors webhook</span>
          <input
            className={inputClassName}
            value={form.slack_webhook_system_errors ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, slack_webhook_system_errors: event.target.value }))}
          />
        </label>

        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-600">ERPIX API Key (masked):</p>
          <p className="mt-1 font-mono text-xs text-slate-800">{erpixApiKeyMasked}</p>
        </div>
      </div>

      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
