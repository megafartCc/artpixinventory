"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { canManagePurchaseOrders } from "@/lib/permissions";
import { calculatePurchaseOrder } from "@/lib/purchase-order-utils";

type VendorProductMapping = {
  productId: string;
  compoundId: string;
  productName: string;
  unitCost: string | null;
  moq: number | null;
  vendorSku: string | null;
  itemsPerBox: number | null;
  boxesPerPallet: number | null;
  weight: string | null;
  itemWeight: string | null;
  weightUnit: string | null;
  uom: string;
};

type VendorOption = {
  id: string;
  name: string;
  defaultLeadTimeDays: number | null;
  enableContainerConstraints: boolean;
  containerTemplateId: string | null;
  products: VendorProductMapping[];
};

type TemplateOption = {
  id: string;
  name: string;
  maxWeightKg: number;
  maxPallets: number;
  maxLooseBoxes: number;
};

type PurchaseOrderFormState = {
  vendorId: string;
  vendorOrderId: string;
  orderDate: string;
  leadTimeDays: string;
  containerTemplateId: string;
  shippingCost: string;
  otherCosts: string;
  notes: string;
  items: Array<{
    productId: string;
    orderedQty: string;
    unitCost: string;
    notes: string;
  }>;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDaysToDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return formatDate(next);
}

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

export function PurchaseOrderFormClient({
  locale,
  vendors,
  templates,
  mode,
  purchaseOrderId,
  initialValue,
}: {
  locale: string;
  vendors: VendorOption[];
  templates: TemplateOption[];
  mode: "create" | "edit";
  purchaseOrderId?: string;
  initialValue?: PurchaseOrderFormState;
}) {
  const t = useTranslations("PurchaseOrderForm");
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManagePurchaseOrders(session?.user?.role);
  const [form, setForm] = useState<PurchaseOrderFormState>(
    initialValue ?? {
      vendorId: "",
      vendorOrderId: "",
      orderDate: formatDate(new Date()),
      leadTimeDays: "",
      containerTemplateId: "",
      shippingCost: "0",
      otherCosts: "0",
      notes: "",
      items: [],
    }
  );
  const [search, setSearch] = useState("");
  const [pendingSubmitType, setPendingSubmitType] = useState<
    "draft" | "submit" | null
  >(null);
  const [error, setError] = useState("");
  useToastFeedback(error);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === form.vendorId) ?? null,
    [form.vendorId, vendors]
  );

  const selectedTemplate = useMemo(() => {
    if (!selectedVendor?.enableContainerConstraints) {
      return null;
    }

    return (
      templates.find(
        (template) =>
          template.id ===
          (form.containerTemplateId || selectedVendor.containerTemplateId)
      ) ?? null
    );
  }, [form.containerTemplateId, selectedVendor, templates]);

  const vendorProducts = useMemo(
    () => selectedVendor?.products ?? [],
    [selectedVendor]
  );

  const filteredVendorProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return vendorProducts;
    }

    return vendorProducts.filter((product) =>
      `${product.compoundId} ${product.productName}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [search, vendorProducts]);

  const calculation = useMemo(() => {
    const items = form.items
      .map((item) => {
        const product = vendorProducts.find((entry) => entry.productId === item.productId);
        if (!product) {
          return null;
        }

        return {
          productId: item.productId,
          orderedQty: Number(item.orderedQty) || 0,
          unitCost: Number(item.unitCost) || 0,
          notes: item.notes || null,
          product: {
            id: product.productId,
            compoundId: product.compoundId,
            name: product.productName,
            uom: product.uom,
            itemsPerBox: product.itemsPerBox,
            boxesPerPallet: product.boxesPerPallet,
            weight: product.weight,
            itemWeight: product.itemWeight,
            weightUnit: product.weightUnit,
          },
        };
      })
      .filter(Boolean) as Array<{
      productId: string;
      orderedQty: number;
      unitCost: number;
      notes: string | null;
      product: {
        id: string;
        compoundId: string;
        name: string;
        uom: string;
        itemsPerBox: number | null;
        boxesPerPallet: number | null;
        weight: string | null;
        itemWeight: string | null;
        weightUnit: string | null;
      };
    }>;

    return calculatePurchaseOrder(
      items,
      Number(form.shippingCost) || 0,
      Number(form.otherCosts) || 0,
      selectedTemplate
    );
  }, [form.items, form.otherCosts, form.shippingCost, selectedTemplate, vendorProducts]);

  const expectedDate = useMemo(() => {
    const leadTime = Number(form.leadTimeDays) || 0;
    return addDaysToDate(form.orderDate, leadTime);
  }, [form.leadTimeDays, form.orderDate]);

  useEffect(() => {
    if (!selectedVendor || initialValue) {
      return;
    }

    setForm((current) => ({
      ...current,
      leadTimeDays:
        selectedVendor.defaultLeadTimeDays === null
          ? ""
          : String(selectedVendor.defaultLeadTimeDays),
      containerTemplateId: selectedVendor.enableContainerConstraints
        ? selectedVendor.containerTemplateId ?? ""
        : "",
    }));
  }, [initialValue, selectedVendor]);

  const refresh = () => startTransition(() => router.refresh());

  const addItem = (mapping: VendorProductMapping) => {
    setError("");
    setForm((current) => {
      if (!current.vendorId) {
        return current;
      }

      if (current.items.some((item) => item.productId === mapping.productId)) {
        return current;
      }

      return {
        ...current,
        items: [
          ...current.items,
          {
            productId: mapping.productId,
            orderedQty: "1",
            unitCost: mapping.unitCost ?? "0",
            notes: "",
          },
        ],
      };
    });
  };

  const updateItem = (
    productId: string,
    field: "orderedQty" | "unitCost" | "notes",
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.productId === productId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeItem = (productId: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.productId !== productId),
    }));
  };

  const submit = async (submitForApproval: boolean) => {
    if (!canManage) {
      return;
    }

    setPendingSubmitType(submitForApproval ? "submit" : "draft");
    setError("");

    const response = await fetch(
      mode === "create"
        ? "/api/purchase-orders"
        : `/api/purchase-orders/${purchaseOrderId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          vendorOrderId: form.vendorOrderId,
          orderDate: form.orderDate,
          leadTimeDays: form.leadTimeDays,
          containerTemplateId:
            selectedVendor?.enableContainerConstraints &&
            (form.containerTemplateId || selectedVendor?.containerTemplateId)
              ? form.containerTemplateId || selectedVendor?.containerTemplateId
              : "",
          shippingCost: form.shippingCost,
          otherCosts: form.otherCosts,
          notes: form.notes,
          items: form.items,
          submitForApproval,
        }),
      }
    );

    const payload = (await response.json()) as {
      error?: string;
      data?: { id: string };
    };
    setPendingSubmitType(null);

    if (!response.ok || !payload.data?.id) {
      setError(payload.error ?? t("feedback.saveFailed"));
      return;
    }

    router.push(`/${locale}/purchase-orders/${payload.data.id}`);
    refresh();
  };

  if (!canManage) {
    return (
      <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          {t("errorPermission")}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/${locale}/purchase-orders`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              {t("back")}
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              {mode === "create" ? t("createTitle") : t("editTitle")}
            </h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("header")}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label={t("vendor")}>
                  <select
                    value={form.vendorId}
                    onChange={(event) => {
                      const vendor = vendors.find(
                        (entry) => entry.id === event.target.value
                      );
                      setForm((current) => ({
                        ...current,
                        vendorId: event.target.value,
                        leadTimeDays:
                          vendor?.defaultLeadTimeDays === null ||
                          vendor?.defaultLeadTimeDays === undefined
                            ? ""
                            : String(vendor.defaultLeadTimeDays),
                        containerTemplateId: vendor?.enableContainerConstraints
                          ? vendor.containerTemplateId ?? ""
                          : "",
                        items: [],
                      }));
                    }}
                    className={inputClassName}
                    required
                  >
                    <option value="">{t("selectVendor")}</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("vendorOrderId")}>
                  <input
                    value={form.vendorOrderId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vendorOrderId: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label={t("orderDate")}>
                  <input
                    value={form.orderDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        orderDate: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    type="date"
                  />
                </Field>
                <Field label={t("leadTime")}>
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
                </Field>
                <Field label={t("expectedDate")}>
                  <input value={expectedDate} className={inputClassName} readOnly />
                </Field>
                {selectedVendor?.enableContainerConstraints && (
                  <Field label={t("containerTemplate")}>
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
                      <option value="">{t("useVendorDefault")}</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{t("itemsTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("itemsSubtitle")}
                  </p>
                </div>
              </div>

              {!selectedVendor ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  {t("selectVendorToAdd")}
                </div>
              ) : (
                <>
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row">
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t("searchPlaceholder")}
                        className={inputClassName}
                      />
                    </div>
                    <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                      {filteredVendorProducts.map((product) => (
                        <button
                          key={product.productId}
                          type="button"
                          onClick={() => addItem(product)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-300"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {product.compoundId}
                            </p>
                            <p className="text-sm text-slate-500">
                              {product.productName}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>{t("defaultCost")}: ${product.unitCost ?? "0.00"}</p>
                            <p>{t("moq")}: {product.moq ?? "-"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">{t("columnProduct")}</th>
                          <th className="px-4 py-3">{t("columnQty")}</th>
                          <th className="px-4 py-3">{t("columnUnitCost")}</th>
                          <th className="px-4 py-3">{t("columnTotal")}</th>
                          <th className="px-4 py-3">{t("columnNotes")}</th>
                          <th className="px-4 py-3 text-right">{t("columnActions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {form.items.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                              {t("noItems")}
                            </td>
                          </tr>
                        ) : (
                          form.items.map((item) => {
                            const product = vendorProducts.find(
                              (entry) => entry.productId === item.productId
                            );
                            const qty = Number(item.orderedQty) || 0;
                            const unitCost = Number(item.unitCost) || 0;
                            const lineTotal = qty * unitCost;
                            const belowMoq =
                              product?.moq !== null &&
                              product?.moq !== undefined &&
                              qty > 0 &&
                              qty < product.moq;

                            return (
                              <tr key={item.productId}>
                                <td className="px-4 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-900">
                                      {product?.compoundId}
                                    </span>
                                    <span>{product?.productName}</span>
                                    {belowMoq && (
                                      <span className="mt-1 text-xs font-medium text-amber-600">
                                        {t("belowMoq", { moq: product?.moq })}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <input
                                    value={item.orderedQty}
                                    onChange={(event) =>
                                      updateItem(
                                        item.productId,
                                        "orderedQty",
                                        event.target.value
                                      )
                                    }
                                    className={inputClassName}
                                    inputMode="numeric"
                                  />
                                </td>
                                <td className="px-4 py-4">
                                  <input
                                    value={item.unitCost}
                                    onChange={(event) =>
                                      updateItem(
                                        item.productId,
                                        "unitCost",
                                        event.target.value
                                      )
                                    }
                                    className={inputClassName}
                                    inputMode="decimal"
                                  />
                                </td>
                                <td className="px-4 py-4 font-semibold text-slate-900">
                                  {currency(lineTotal)}
                                </td>
                                <td className="px-4 py-4">
                                  <input
                                    value={item.notes}
                                    onChange={(event) =>
                                      updateItem(item.productId, "notes", event.target.value)
                                    }
                                    className={inputClassName}
                                  />
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => removeItem(item.productId)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      {t("remove")}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="space-y-6">
            {selectedVendor?.enableContainerConstraints && selectedTemplate && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("calculatorTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("calculatorSubtitle", { template: selectedTemplate.name })}
                </p>
                <div className="mt-5 space-y-4">
                  <Meter
                    label={t("meterWeight")}
                    value={calculation.totalWeightKg}
                    max={selectedTemplate.maxWeightKg}
                    suffix="kg"
                  />
                  <Meter
                    label={t("meterPallets")}
                    value={calculation.totalPallets}
                    max={selectedTemplate.maxPallets}
                  />
                  <Meter
                    label={t("meterLooseBoxes")}
                    value={calculation.totalLooseBoxes}
                    max={selectedTemplate.maxLooseBoxes}
                  />
                </div>
                {calculation.constraintWarnings.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {calculation.constraintWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("costsTitle")}</h2>
              <div className="mt-5 grid gap-4">
                <Field label={t("shippingCost")}>
                  <input
                    value={form.shippingCost}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        shippingCost: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    inputMode="decimal"
                  />
                </Field>
                <Field label={t("otherCosts")}>
                  <input
                    value={form.otherCosts}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        otherCosts: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    inputMode="decimal"
                  />
                </Field>
                <Field label={t("notes")}>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className={`${inputClassName} min-h-28 resize-y`}
                  />
                </Field>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{t("subtotal")}</span>
                  <span className="font-semibold text-slate-900">
                    {currency(calculation.subtotal)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>{t("shipping")}</span>
                  <span>{currency(Number(form.shippingCost) || 0)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>{t("otherCosts")}</span>
                  <span>{currency(Number(form.otherCosts) || 0)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-base font-semibold text-slate-900">
                  <span>{t("total")}</span>
                  <span>{currency(calculation.totalCost)}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void submit(false)}
                  disabled={pendingSubmitType !== null || !form.vendorId}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingSubmitType === "draft" ? t("saving") : t("saveDraft")}
                </button>
                <button
                  type="button"
                  onClick={() => void submit(true)}
                  disabled={pendingSubmitType !== null || !form.vendorId}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingSubmitType === "submit"
                    ? t("submitting")
                    : t("submitApproval")}
                </button>
              </div>
            </section>
          </div>
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

function Meter({
  label,
  value,
  max,
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const exceeded = value > max;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-medium text-slate-700">
        <span>{label}</span>
        <span className={exceeded ? "text-rose-600" : "text-slate-500"}>
          {value}
          {suffix ? ` ${suffix}` : ""} / {max}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${exceeded ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
