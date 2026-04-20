"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
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
  isDefault: boolean;
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

function parseQty(value: string) {
  return Math.max(1, Number(value) || 1);
}

function parseMoney(value: string) {
  return Math.max(0, Number(value) || 0);
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
  const [pendingSubmitType, setPendingSubmitType] = useState<"draft" | "submit" | null>(null);
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
          template.id === (form.containerTemplateId || selectedVendor.containerTemplateId)
      ) ?? null
    );
  }, [form.containerTemplateId, selectedVendor, templates]);

  const vendorProducts = useMemo(
    () =>
      [...(selectedVendor?.products ?? [])].sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1;
        }
        return left.compoundId.localeCompare(right.compoundId);
      }),
    [selectedVendor]
  );

  const filteredVendorProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return vendorProducts.slice(0, 16);
    }

    return vendorProducts
      .filter((product) =>
        `${product.compoundId} ${product.productName} ${product.vendorSku ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 16);
  }, [search, vendorProducts]);

  const quickSuggestions = useMemo(
    () => vendorProducts.filter((product) => product.isDefault).slice(0, 6),
    [vendorProducts]
  );

  const selectedItems = useMemo(
    () =>
      form.items
        .map((item) => ({
          ...item,
          product: vendorProducts.find((entry) => entry.productId === item.productId) ?? null,
        }))
        .filter((item) => item.product !== null),
    [form.items, vendorProducts]
  );

  const calculation = useMemo(() => {
    const items = selectedItems.map((item) => ({
      productId: item.productId,
      orderedQty: Number(item.orderedQty) || 0,
      unitCost: Number(item.unitCost) || 0,
      notes: item.notes || null,
      product: {
        id: item.product!.productId,
        compoundId: item.product!.compoundId,
        name: item.product!.productName,
        uom: item.product!.uom,
        itemsPerBox: item.product!.itemsPerBox,
        boxesPerPallet: item.product!.boxesPerPallet,
        weight: item.product!.weight,
        itemWeight: item.product!.itemWeight,
        weightUnit: item.product!.weightUnit,
      },
    }));

    return calculatePurchaseOrder(
      items,
      parseMoney(form.shippingCost),
      parseMoney(form.otherCosts),
      selectedTemplate
    );
  }, [form.otherCosts, form.shippingCost, selectedItems, selectedTemplate]);

  const expectedDate = useMemo(() => {
    const leadTime = Number(form.leadTimeDays) || 0;
    return addDaysToDate(form.orderDate, leadTime);
  }, [form.leadTimeDays, form.orderDate]);

  const zeroCostCount = selectedItems.filter((item) => parseMoney(item.unitCost) <= 0).length;
  const moqWarningCount = selectedItems.filter((item) => {
    const moq = item.product?.moq ?? null;
    return moq !== null && parseQty(item.orderedQty) < moq;
  }).length;
  const approvalIssues = zeroCostCount + moqWarningCount + calculation.constraintWarnings.length;
  const missingVendor = form.vendorId.trim() === "";
  const missingItems = !missingVendor && form.items.length === 0;
  const requiredNotice = missingVendor
    ? t("requiredVendorNotice")
    : missingItems
      ? t("requiredItemsNotice")
      : "";
  const canSubmit = !missingVendor && !missingItems;

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
      const existing = current.items.find((item) => item.productId === mapping.productId);
      if (existing) {
        return {
          ...current,
          items: current.items.map((item) =>
            item.productId === mapping.productId
              ? { ...item, orderedQty: String(parseQty(item.orderedQty) + 1) }
              : item
          ),
        };
      }

      return {
        ...current,
        items: [
          {
            productId: mapping.productId,
            orderedQty: "1",
            unitCost: mapping.unitCost ?? "0",
            notes: "",
          },
          ...current.items,
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
      mode === "create" ? "/api/purchase-orders" : `/api/purchase-orders/${purchaseOrderId}`,
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
      <div className="p-6 lg:p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          {t("errorPermission")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href={`/${locale}/purchase-orders`}
                className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                {t("back")}
              </Link>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {mode === "create" ? t("createTitle") : t("editTitle")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Faster PO build flow with default-first quick add, approval readiness, and a sticky summary rail.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
              <MetricCard title="Line items" value={String(selectedItems.length)} icon={PackagePlus} />
              <MetricCard title="Approval issues" value={String(approvalIssues)} icon={ShieldCheck} />
              <MetricCard title="Total" value={currency(calculation.totalCost)} icon={CheckCircle2} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("header")}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label={t("vendor")}>
                <select
                  value={form.vendorId}
                  onChange={(event) => {
                    const vendor = vendors.find((entry) => entry.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      vendorId: event.target.value,
                      leadTimeDays:
                        vendor?.defaultLeadTimeDays === null || vendor?.defaultLeadTimeDays === undefined
                          ? ""
                          : String(vendor.defaultLeadTimeDays),
                      containerTemplateId: vendor?.enableContainerConstraints ? vendor.containerTemplateId ?? "" : "",
                      items: [],
                    }));
                    setSearch("");
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
                  onChange={(event) => setForm((current) => ({ ...current, vendorOrderId: event.target.value }))}
                  className={inputClassName}
                />
              </Field>
              <Field label={t("orderDate")}>
                <input
                  value={form.orderDate}
                  onChange={(event) => setForm((current) => ({ ...current, orderDate: event.target.value }))}
                  className={inputClassName}
                  type="date"
                />
              </Field>
              <Field label={t("leadTime")}>
                <input
                  value={form.leadTimeDays}
                  onChange={(event) => setForm((current) => ({ ...current, leadTimeDays: event.target.value }))}
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
                      setForm((current) => ({ ...current, containerTemplateId: event.target.value }))
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

          <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.15fr)]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Approval readiness</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                <SummaryMetric label="Zero-cost lines" value={String(zeroCostCount)} tone={zeroCostCount > 0 ? "amber" : "slate"} />
                <SummaryMetric label="MOQ warnings" value={String(moqWarningCount)} tone={moqWarningCount > 0 ? "amber" : "slate"} />
                <SummaryMetric
                  label="Constraint warnings"
                  value={String(calculation.constraintWarnings.length)}
                  tone={calculation.constraintWarnings.length > 0 ? "rose" : "slate"}
                />
              </div>
              {calculation.constraintWarnings.length > 0 && (
                <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
                    <div className="space-y-2">
                      {calculation.constraintWarnings.map((warning) => (
                        <p key={warning} className="text-sm text-rose-700">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {selectedVendor?.enableContainerConstraints && selectedTemplate ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900">{t("calculatorTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("calculatorSubtitle", { template: selectedTemplate.name })}
                </p>
                <div className="mt-5 space-y-4">
                  <Meter label={t("meterWeight")} value={calculation.totalWeightKg} max={selectedTemplate.maxWeightKg} suffix="kg" />
                  <Meter label={t("meterPallets")} value={calculation.totalPallets} max={selectedTemplate.maxPallets} />
                  <Meter label={t("meterLooseBoxes")} value={calculation.totalLooseBoxes} max={selectedTemplate.maxLooseBoxes} />
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900">{t("calculatorTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a vendor with container constraints to unlock the live load calculator.
                </p>
                <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
                  Container planning will appear here when a constrained vendor/template is selected.
                </div>
              </section>
            )}

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{t("costsTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Keep shipping, extra charges, notes, and approval actions together while building the PO.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {currency(calculation.totalCost)}
                </span>
              </div>

              {(missingVendor || missingItems) && (
                <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4" role="alert" aria-live="polite">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-800">{t("requiredInfoTitle")}</p>
                      <p className="text-sm text-amber-700">{requiredNotice}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label={t("shippingCost")}>
                  <input
                    value={form.shippingCost}
                    onChange={(event) => setForm((current) => ({ ...current, shippingCost: event.target.value }))}
                    className={inputClassName}
                    inputMode="decimal"
                  />
                </Field>
                <Field label={t("otherCosts")}>
                  <input
                    value={form.otherCosts}
                    onChange={(event) => setForm((current) => ({ ...current, otherCosts: event.target.value }))}
                    className={inputClassName}
                    inputMode="decimal"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label={t("notes")}>
                    <textarea
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      className={`${inputClassName} min-h-24 resize-y`}
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  <SummaryRow label={t("subtotal")} value={currency(calculation.subtotal)} />
                  <SummaryRow label={t("shipping")} value={currency(parseMoney(form.shippingCost))} />
                  <SummaryRow label={t("otherCosts")} value={currency(parseMoney(form.otherCosts))} />
                  <SummaryRow label={t("total")} value={currency(calculation.totalCost)} emphasize />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void submit(false)}
                  disabled={pendingSubmitType !== null || !canSubmit}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {pendingSubmitType === "draft" ? t("saving") : t("saveDraft")}
                </button>
                <button
                  type="button"
                  onClick={() => void submit(true)}
                  disabled={pendingSubmitType !== null || !canSubmit}
                  className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {pendingSubmitType === "submit" ? t("submitting") : t("submitApproval")}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {missingVendor
                  ? t("requiredVendorNotice")
                  : missingItems
                    ? t("requiredItemsNotice")
                    : t("readyHint")}
              </p>
            </section>
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{t("itemsTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t("itemsSubtitle")}</p>
                </div>
                {quickSuggestions.length > 0 && (
                  <div className="flex max-w-full flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
                    {quickSuggestions.map((product) => (
                      <button
                        key={product.productId}
                        type="button"
                        onClick={() => addItem(product)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {product.compoundId}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!selectedVendor ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  {t("selectVendorToAdd")}
                </div>
              ) : (
                <>
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <label className="text-sm font-medium text-slate-700">Quick add products</label>
                    <div className="relative mt-3">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && filteredVendorProducts[0]) {
                            event.preventDefault();
                            addItem(filteredVendorProducts[0]);
                          }
                        }}
                        placeholder={t("searchPlaceholder")}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                      {filteredVendorProducts.map((product) => (
                        <button
                          key={product.productId}
                          type="button"
                          onClick={() => addItem(product)}
                          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{product.compoundId}</p>
                              {product.isDefault && (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{product.productName}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {product.vendorSku ? `Vendor SKU ${product.vendorSku} / ` : ""}{product.uom.toUpperCase()}
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

                  <div className="mt-5 space-y-4">
                    {selectedItems.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
                        {t("noItems")}
                      </div>
                    ) : (
                      selectedItems.map((item) => {
                        const product = item.product!;
                        const qty = parseQty(item.orderedQty);
                        const unitCost = parseMoney(item.unitCost);
                        const lineTotal = qty * unitCost;
                        const belowMoq = product.moq !== null && qty < product.moq;

                        return (
                          <div key={item.productId} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-lg font-semibold tracking-tight text-slate-900">
                                    {product.compoundId}
                                  </p>
                                  {product.isDefault && (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                      Default
                                    </span>
                                  )}
                                  {belowMoq && (
                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                                      Below MOQ
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm text-slate-500">{product.productName}</p>
                                <p className="mt-2 text-xs text-slate-400">
                                  {product.vendorSku ? `Vendor SKU ${product.vendorSku} / ` : ""}{product.uom.toUpperCase()}
                                  {product.moq !== null ? ` / MOQ ${product.moq}` : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.productId)}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t("remove")}
                              </button>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-[180px_180px_minmax(0,1fr)_180px]">
                              <Field label={t("columnQty")}>
                                <div className="flex items-center gap-2">
                                  <StepButton
                                    onClick={() => updateItem(item.productId, "orderedQty", String(Math.max(1, qty - 1)))}
                                  >
                                    -
                                  </StepButton>
                                  <input
                                    value={item.orderedQty}
                                    onChange={(event) => updateItem(item.productId, "orderedQty", event.target.value)}
                                    className={`${inputClassName} text-center`}
                                    inputMode="numeric"
                                  />
                                  <StepButton onClick={() => updateItem(item.productId, "orderedQty", String(qty + 1))}>
                                    +
                                  </StepButton>
                                </div>
                              </Field>
                              <Field label={t("columnUnitCost")}>
                                <input
                                  value={item.unitCost}
                                  onChange={(event) => updateItem(item.productId, "unitCost", event.target.value)}
                                  className={inputClassName}
                                  inputMode="decimal"
                                />
                              </Field>
                              <Field label={t("columnNotes")}>
                                <input
                                  value={item.notes}
                                  onChange={(event) => updateItem(item.productId, "notes", event.target.value)}
                                  className={inputClassName}
                                />
                              </Field>
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  {t("columnTotal")}
                                </p>
                                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                                  {currency(lineTotal)}
                                </p>
                              </div>
                            </div>

                            {belowMoq && (
                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                {t("belowMoq", { moq: product.moq ?? 0 })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={pendingSubmitType !== null || !canSubmit}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 text-base font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {pendingSubmitType === "draft" ? t("saving") : t("saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={pendingSubmitType !== null || !canSubmit}
              className="flex-1 rounded-2xl bg-sky-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {pendingSubmitType === "submit" ? t("submitting") : t("submitApproval")}
            </button>
          </div>
          {(missingVendor || missingItems) && (
            <p className="mx-auto mt-3 max-w-5xl text-xs text-amber-700">
              {requiredNotice}
            </p>
          )}
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

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function StepButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "amber" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
      <p className={`text-sm ${emphasize ? "font-semibold text-slate-900" : "font-medium text-slate-600"}`}>
        {label}
      </p>
      <p className={`${emphasize ? "text-lg font-semibold text-slate-900" : "text-sm font-semibold text-slate-900"}`}>
        {value}
      </p>
    </div>
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
