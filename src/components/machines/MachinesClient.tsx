"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Cog, Pencil, Plus, RefreshCcw, X } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { canManageMachines } from "@/lib/permissions";

type MachineRecord = {
  id: string;
  name: string;
  type: "STN" | "VITRO";
  erpixMachineId: string | null;
  active: boolean;
  notes: string | null;
  locationId: string;
  locationName: string;
};

type LocationOption = {
  id: string;
  label: string;
  type: string;
};

type FormState = {
  name: string;
  type: "STN" | "VITRO";
  locationId: string;
  erpixMachineId: string;
  notes: string;
  active: boolean;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function MachinesClient({
  initialMachines,
  locationOptions,
  locale,
}: {
  initialMachines: MachineRecord[];
  locationOptions: LocationOption[];
  locale: string;
}) {
  const t = useTranslations("Machines");
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageMachines(session?.user?.role);
  const [machines] = useState(initialMachines);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  useToastFeedback(error, feedback);
  const [form, setForm] = useState<FormState>({
    name: "",
    type: "STN",
    locationId: locationOptions[0]?.id ?? "",
    erpixMachineId: "",
    notes: "",
    active: true,
  });

  const filteredMachines = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return machines;
    }

    return machines.filter((machine) =>
      [
        machine.name,
        machine.type,
        machine.locationName,
        machine.erpixMachineId ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [machines, query]);

  const refresh = () => startTransition(() => router.refresh());

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      type: "STN",
      locationId: locationOptions[0]?.id ?? "",
      erpixMachineId: "",
      notes: "",
      active: true,
    });
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const openEdit = (machine: MachineRecord) => {
    setEditingId(machine.id);
    setForm({
      name: machine.name,
      type: machine.type,
      locationId: machine.locationId,
      erpixMachineId: machine.erpixMachineId ?? "",
      notes: machine.notes ?? "",
      active: machine.active,
    });
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(
      editingId ? `/api/machines/${editingId}` : "/api/machines",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setSubmitting(false);
      setError(result.error ?? t("feedback.saveFailed"));
      return;
    }

    setSubmitting(false);
    setFeedback(result.message ?? t("feedback.saved"));
    setDrawerOpen(false);
    refresh();
  };

  const syncPlaceholder = () => {
    setError("");
    setFeedback(t("feedback.syncNotConfigured"));
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={syncPlaceholder}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              {t("syncFromErpix")}
            </button>
            {canManage && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                {t("newMachine")}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className={inputClassName}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("columns.name")}</th>
                  <th className="px-4 py-3">{t("columns.type")}</th>
                  <th className="px-4 py-3">{t("columns.sublocation")}</th>
                  <th className="px-4 py-3">{t("columns.erpixId")}</th>
                  <th className="px-4 py-3">{t("columns.active")}</th>
                  <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredMachines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                      {t("noMatch")}
                    </td>
                  </tr>
                ) : (
                  filteredMachines.map((machine) => (
                    <tr key={machine.id}>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {machine.name}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            machine.type === "STN"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {machine.type}
                        </span>
                      </td>
                      <td className="px-4 py-4">{machine.locationName}</td>
                      <td className="px-4 py-4">{machine.erpixMachineId || "—"}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            machine.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {machine.active ? t("active") : t("inactive")}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/${locale}/machines/${machine.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <Cog className="h-3.5 w-3.5" />
                            {t("view")}
                          </Link>
                          {canManage && (
                            <button
                              onClick={() => openEdit(machine)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("edit")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-full flex-1 cursor-default"
          />
          <div className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingId ? t("editMachine") : t("createMachine")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("drawerSubtitle")}
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-1 flex-col">
              <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("name")}</span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className={inputClassName}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("type")}</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as "STN" | "VITRO",
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="STN">STN</option>
                    <option value="VITRO">VITRO</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("assignedSublocation")}</span>
                  <select
                    value={form.locationId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        locationId: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  >
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("erpixMachineId")}</span>
                  <input
                    value={form.erpixMachineId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        erpixMachineId: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("notes")}</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={`${inputClassName} min-h-28 resize-y`}
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.checked }))
                    }
                  />
                  {t("active")}
                </label>
              </div>

              <div className="border-t border-slate-200 px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {editingId ? t("saveChanges") : t("createMachine")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
