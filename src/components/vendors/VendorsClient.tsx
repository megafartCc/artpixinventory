"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Plus, X } from "lucide-react";
import { canManageVendors } from "@/lib/permissions";

type TemplateOption = {
  id: string;
  name: string;
};

type VendorRecord = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  paymentTerms: string | null;
  defaultLeadTimeDays: number | null;
  enableContainerConstraints: boolean;
  containerTemplateId: string | null;
  containerTemplateName: string | null;
  notes: string | null;
  active: boolean;
  productCount: number;
  purchaseOrderCount: number;
};

type VendorFormState = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  paymentTerms: string;
  defaultLeadTimeDays: string;
  enableContainerConstraints: boolean;
  containerTemplateId: string;
  notes: string;
  active: boolean;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

const emptyForm: VendorFormState = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  country: "",
  paymentTerms: "",
  defaultLeadTimeDays: "",
  enableContainerConstraints: false,
  containerTemplateId: "",
  notes: "",
  active: true,
};

export function VendorsClient({
  initialVendors,
  templates,
  locale,
}: {
  initialVendors: VendorRecord[];
  templates: TemplateOption[];
  locale: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageVendors(session?.user?.role);
  const vendors = initialVendors;
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const filteredVendors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return vendors;
    }

    return vendors.filter((vendor) =>
      [
        vendor.name,
        vendor.country ?? "",
        vendor.paymentTerms ?? "",
        vendor.contactName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, vendors]);

  const refresh = () => startTransition(() => router.refresh());

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const openEdit = (vendor: VendorRecord) => {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      contactName: vendor.contactName ?? "",
      email: vendor.email ?? "",
      phone: vendor.phone ?? "",
      address: vendor.address ?? "",
      country: vendor.country ?? "",
      paymentTerms: vendor.paymentTerms ?? "",
      defaultLeadTimeDays:
        vendor.defaultLeadTimeDays === null
          ? ""
          : String(vendor.defaultLeadTimeDays),
      enableContainerConstraints: vendor.enableContainerConstraints,
      containerTemplateId: vendor.containerTemplateId ?? "",
      notes: vendor.notes ?? "",
      active: vendor.active,
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
      editingId ? `/api/vendors/${editingId}` : "/api/vendors",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          defaultLeadTimeDays: form.defaultLeadTimeDays,
          containerTemplateId: form.enableContainerConstraints
            ? form.containerTemplateId
            : "",
        }),
      }
    );

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Vendor save failed.");
      return;
    }

    setFeedback(payload.message ?? "Vendor saved.");
    setDrawerOpen(false);
    refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
            <p className="mt-1 text-slate-500">
              Supplier records, default lead times, and product mapping ownership.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/${locale}/container-templates`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Container Templates
            </Link>
            {canManage && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                New Vendor
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vendor, country, payment terms, or contact"
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
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Payment Terms</th>
                  <th className="px-4 py-3">Lead Time</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                      No vendors match the current search.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {vendor.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {vendor.productCount} products mapped
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">{vendor.country || "-"}</td>
                      <td className="px-4 py-4">{vendor.paymentTerms || "-"}</td>
                      <td className="px-4 py-4">
                            {vendor.defaultLeadTimeDays === null
                              ? "-"
                              : `${vendor.defaultLeadTimeDays} days`}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            vendor.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {vendor.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/${locale}/vendors/${vendor.id}`}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            View
                          </Link>
                          {canManage && (
                            <button
                              onClick={() => openEdit(vendor)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
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
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-full flex-1 cursor-default"
          />
          <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingId ? "Edit Vendor" : "Create Vendor"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Capture supplier contacts, lead times, and optional container defaults.
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
              <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5 md:grid-cols-2">
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
                <Field label="Contact Name">
                  <input
                    value={form.contactName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contactName: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    className={inputClassName}
                    type="email"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Country">
                  <input
                    value={form.country}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, country: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Payment Terms">
                  <input
                    value={form.paymentTerms}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentTerms: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Default Lead Time (days)">
                  <input
                    value={form.defaultLeadTimeDays}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        defaultLeadTimeDays: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    inputMode="numeric"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Address">
                    <textarea
                      value={form.address}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      className={`${inputClassName} min-h-24 resize-y`}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.enableContainerConstraints}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          enableContainerConstraints: event.target.checked,
                          containerTemplateId: event.target.checked
                            ? current.containerTemplateId
                            : "",
                        }))
                      }
                    />
                    Enable container constraints
                  </label>
                  {form.enableContainerConstraints && (
                    <div className="mt-4">
                      <Field label="Default Container Template">
                        <select
                          value={form.containerTemplateId}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              containerTemplateId: event.target.value,
                            }))
                          }
                          className={inputClassName}
                        >
                          <option value="">None selected</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Field label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      className={`${inputClassName} min-h-28 resize-y`}
                    />
                  </Field>
                </div>
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
                    {editingId ? "Save Changes" : "Create Vendor"}
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
