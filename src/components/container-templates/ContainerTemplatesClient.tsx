"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { canManageVendors } from "@/lib/permissions";

type TemplateRecord = {
  id: string;
  name: string;
  maxWeightKg: string;
  maxPallets: number;
  maxLooseBoxes: number;
  description: string | null;
  active: boolean;
  vendorCount: number;
  purchaseOrderCount: number;
};

type TemplateFormState = {
  name: string;
  maxWeightKg: string;
  maxPallets: string;
  maxLooseBoxes: string;
  description: string;
  active: boolean;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

const emptyForm: TemplateFormState = {
  name: "",
  maxWeightKg: "",
  maxPallets: "",
  maxLooseBoxes: "",
  description: "",
  active: true,
};

export function ContainerTemplatesClient({
  templates,
  locale,
}: {
  templates: TemplateRecord[];
  locale: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageVendors(session?.user?.role);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyForm);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return templates;
    }

    return templates.filter((template) =>
      [template.name, template.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, templates]);

  const refresh = () => startTransition(() => router.refresh());

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const openEdit = (template: TemplateRecord) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      maxWeightKg: template.maxWeightKg,
      maxPallets: String(template.maxPallets),
      maxLooseBoxes: String(template.maxLooseBoxes),
      description: template.description ?? "",
      active: template.active,
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
      editingId ? `/api/container-templates/${editingId}` : "/api/container-templates",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Template save failed.");
      return;
    }

    setFeedback(payload.message ?? "Template saved.");
    setDrawerOpen(false);
    refresh();
  };

  const removeTemplate = async (template: TemplateRecord) => {
    const confirmed = window.confirm(`Delete "${template.name}"?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/container-templates/${template.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Delete failed.");
      return;
    }

    setFeedback(payload.message ?? "Template deleted.");
    refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Container Templates</h1>
            <p className="mt-1 text-slate-500">
              Constraint presets used by purchasing and vendor defaults.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/${locale}/vendors`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Back to Vendors
            </Link>
            {canManage && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                New Template
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search template name or description"
            className={inputClassName}
          />
        </div>

        {(error || feedback) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || feedback}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Max Weight</th>
                  <th className="px-4 py-3">Max Pallets</th>
                  <th className="px-4 py-3">Loose Boxes</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                      No templates match the current search.
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {template.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {template.description || "No description"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">{template.maxWeightKg} kg</td>
                      <td className="px-4 py-4">{template.maxPallets}</td>
                      <td className="px-4 py-4">{template.maxLooseBoxes}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            template.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {template.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEdit(template)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => void removeTemplate(template)}
                                disabled={
                                  template.vendorCount > 0 ||
                                  template.purchaseOrderCount > 0
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </>
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
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-full flex-1 cursor-default"
          />
          <div className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingId ? "Edit Template" : "Create Template"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure non-blocking container capacity presets.
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5">
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className={inputClassName}
                    required
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Max Weight (kg)">
                    <input
                      value={form.maxWeightKg}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxWeightKg: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      inputMode="decimal"
                      required
                    />
                  </Field>
                  <Field label="Max Pallets">
                    <input
                      value={form.maxPallets}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxPallets: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      inputMode="numeric"
                      required
                    />
                  </Field>
                </div>
                <Field label="Max Loose Boxes">
                  <input
                    value={form.maxLooseBoxes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxLooseBoxes: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    inputMode="numeric"
                    required
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className={`${inputClassName} min-h-24 resize-y`}
                  />
                </Field>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>

              <div className="border-t border-slate-200 px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {editingId ? "Save Changes" : "Create Template"}
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
