"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Trash2 } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { canManageVendors } from "@/lib/permissions";
import { ActivityTimeline } from "@/components/ActivityTimeline";

type ProductOption = {
  id: string;
  compoundId: string;
  name: string;
};

type ProductMapping = {
  id: string;
  productId: string;
  compoundId: string;
  productName: string;
  isDefault: boolean;
  moq: number | null;
  unitCost: string | null;
  leadTimeDays: number | null;
  vendorSku: string | null;
  notes: string | null;
};

type PurchaseOrderSummary = {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  totalCost: string;
};

type MappingFormState = {
  productId: string;
  productSearch: string;
  isDefault: boolean;
  moq: string;
  unitCost: string;
  leadTimeDays: string;
  vendorSku: string;
  notes: string;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function VendorDetailClient({
  locale,
  vendorId,
  vendorName,
  vendorInfo,
  products,
  mappings,
  purchaseOrders,
}: {
  locale: string;
  vendorId: string;
  vendorName: string;
  vendorInfo: {
    country: string | null;
    paymentTerms: string | null;
    defaultLeadTimeDays: number | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    active: boolean;
    containerTemplateName: string | null;
    enableContainerConstraints: boolean;
  };
  products: ProductOption[];
  mappings: ProductMapping[];
  purchaseOrders: PurchaseOrderSummary[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageVendors(session?.user?.role);
  const [productSearch, setProductSearch] = useState("");
  const [form, setForm] = useState<MappingFormState>({
    productId: "",
    productSearch: "",
    isDefault: false,
    moq: "",
    unitCost: "",
    leadTimeDays: "",
    vendorSku: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(error, feedback);

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();
    if (!normalized) {
      return products;
    }

    return products.filter((product) =>
      [product.compoundId, product.name]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [productSearch, products]);

  const refresh = () => startTransition(() => router.refresh());

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(`/api/vendors/${vendorId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.productId,
        isDefault: form.isDefault,
        moq: form.moq,
        unitCost: form.unitCost,
        leadTimeDays: form.leadTimeDays,
        vendorSku: form.vendorSku,
        notes: form.notes,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Mapping save failed.");
      return;
    }

    setFeedback(payload.message ?? "Vendor mapping saved.");
    setForm({
      productId: "",
      productSearch: "",
      isDefault: false,
      moq: "",
      unitCost: "",
      leadTimeDays: "",
      vendorSku: "",
      notes: "",
    });
    setProductSearch("");
    refresh();
  };

  const removeMapping = async (mapping: ProductMapping) => {
    const confirmed = window.confirm(
      `Remove ${mapping.compoundId} from ${vendorName}?`
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(
      `/api/vendors/${vendorId}/products/${mapping.id}`,
      { method: "DELETE" }
    );
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Delete failed.");
      return;
    }

    setFeedback(payload.message ?? "Vendor mapping deleted.");
    refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/${locale}/vendors`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Back to Vendors
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{vendorName}</h1>
            <p className="mt-1 text-slate-500">
              Product mapping, purchasing defaults, and PO history.
            </p>
          </div>
          <Link
            href={`/${locale}/container-templates`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Container Templates
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Vendor Info</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoCard label="Country" value={vendorInfo.country} />
              <InfoCard label="Payment Terms" value={vendorInfo.paymentTerms} />
              <InfoCard
                label="Lead Time"
                value={
                  vendorInfo.defaultLeadTimeDays === null
                    ? null
                    : `${vendorInfo.defaultLeadTimeDays} days`
                }
              />
              <InfoCard
                label="Container Template"
                value={vendorInfo.containerTemplateName}
              />
              <InfoCard label="Contact" value={vendorInfo.contactName} />
              <InfoCard label="Email" value={vendorInfo.email} />
              <InfoCard label="Phone" value={vendorInfo.phone} />
              <InfoCard
                label="Status"
                value={vendorInfo.active ? "Active" : "Inactive"}
              />
            </dl>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Address
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {vendorInfo.address || "No address on file."}
              </p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {vendorInfo.notes || "No vendor notes yet."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Add Product Mapping</h2>
            {!canManage ? (
              <p className="mt-4 text-sm text-slate-400">
                Your role is read-only for vendor mappings.
              </p>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Search Product</span>
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Filter by compound ID or name"
                    className={inputClassName}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Product</span>
                  <select
                    value={form.productId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        productId: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    required
                  >
                    <option value="">Select a product</option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.compoundId} - {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>MOQ</span>
                    <input
                      value={form.moq}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, moq: event.target.value }))
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>Unit Cost</span>
                    <input
                      value={form.unitCost}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          unitCost: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      inputMode="decimal"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>Lead Time (days)</span>
                    <input
                      value={form.leadTimeDays}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          leadTimeDays: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>Vendor SKU</span>
                    <input
                      value={form.vendorSku}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          vendorSku: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    />
                  </label>
                </div>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isDefault: event.target.checked,
                      }))
                    }
                  />
                  Default vendor mapping
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={`${inputClassName} min-h-24 resize-y`}
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : "Save Mapping"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Product Mapping</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Default</th>
                  <th className="px-4 py-3">MOQ</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Lead Time</th>
                  <th className="px-4 py-3">Vendor SKU</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                      No product mappings yet.
                    </td>
                  </tr>
                ) : (
                  mappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {mapping.compoundId}
                          </span>
                          <span>{mapping.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {mapping.isDefault ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-4">{mapping.moq ?? "-"}</td>
                      <td className="px-4 py-4">
                        {mapping.unitCost === null ? "-" : `$${mapping.unitCost}`}
                      </td>
                      <td className="px-4 py-4">
                        {mapping.leadTimeDays === null
                          ? "-"
                          : `${mapping.leadTimeDays} days`}
                      </td>
                      <td className="px-4 py-4">{mapping.vendorSku || "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          {canManage && (
                            <button
                              onClick={() => void removeMapping(mapping)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
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
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">PO History</h2>
          {purchaseOrders.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
              No purchase orders for this vendor yet.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">PO Number</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Order Date</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {po.poNumber}
                      </td>
                      <td className="px-4 py-4">{po.status}</td>
                      <td className="px-4 py-4">{po.orderDate}</td>
                      <td className="px-4 py-4">${po.totalCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Activity history</h2>
          <ActivityTimeline entityType="Vendor" entityId={vendorId} />
        </section>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-base font-semibold text-slate-900">
        {value || "-"}
      </dd>
    </div>
  );
}
