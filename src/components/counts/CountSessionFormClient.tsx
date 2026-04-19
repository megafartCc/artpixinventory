"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function CountSessionFormClient({
  locale,
  locations,
  users,
}: {
  locale: string;
  locations: Array<{ id: string; name: string; type: string }>;
  users: Array<{ id: string; name: string; role: string }>;
}) {
  const t = useTranslations("Counts");
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    locationId: "",
    type: "FULL",
    assignedToId: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useToastFeedback(error);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as {
      error?: string;
      data?: { id: string };
    };

    setSubmitting(false);

    if (!response.ok || !payload.data) {
      setError(payload.error ?? t("errors.createFailed"));
      return;
    }

    router.push(`/${locale}/counts/${payload.data.id}`);
    router.refresh();
  };

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div>
          <Link
            href={`/${locale}/counts`}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            {t("back")}
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{t("newTitle")}</h1>
          <p className="mt-1 text-slate-500">{t("newSubtitle")}</p>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label={t("fields.name")}>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClassName}
                placeholder="Weekly cycle count - Zone A"
              />
            </Field>

            <Field label={t("fields.type")}>
              <select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className={inputClassName}
              >
                <option value="FULL">{t("types.FULL")}</option>
                <option value="CYCLE">{t("types.CYCLE")}</option>
                <option value="SPOT">{t("types.SPOT")}</option>
              </select>
            </Field>

            <Field label={t("fields.location")}>
              <select
                value={form.locationId}
                onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))}
                className={inputClassName}
              >
                <option value="">{t("selectLocation")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.type})
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("fields.assignedTo")}>
              <select
                value={form.assignedToId}
                onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}
                className={inputClassName}
              >
                <option value="">{t("selectUser")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </Field>

            <div className="lg:col-span-2">
              <Field label={t("fields.notes")}>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className={`${inputClassName} min-h-32`}
                  placeholder="Instructions for the counter or review team."
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href={`/${locale}/counts`}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50 lg:min-h-0 lg:text-sm"
            >
              {t("cancel")}
            </Link>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 lg:min-h-0 lg:text-sm"
            >
              {submitting ? t("creating") : t("create")}
            </button>
          </div>
        </section>
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
