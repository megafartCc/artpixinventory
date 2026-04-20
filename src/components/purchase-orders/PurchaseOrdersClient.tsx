"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { canApprovePurchaseOrders, canManagePurchaseOrders } from "@/lib/permissions";
import { getPoStatusTone } from "@/lib/purchase-order-utils";
import { useSavedViews } from "@/hooks/useSavedViews";
import { useToastFeedback } from "@/hooks/useToastFeedback";

type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  orderDate: string;
  expectedDate: string;
  totalCost: string;
  createdBy: string;
};

export function PurchaseOrdersClient({
  locale,
  purchaseOrders,
}: {
  locale: string;
  purchaseOrders: PurchaseOrderRow[];
}) {
  const t = useTranslations("PurchaseOrders");
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "WAREHOUSE";
  const canManage = canManagePurchaseOrders(session?.user?.role);
  const canApprove = canApprovePurchaseOrders(session?.user?.role);
  const {
    state: filters,
    setState: setFilters,
    views,
    saveView,
    deleteView,
    resetState,
  } = useSavedViews("artpix:purchase-orders:list", {
    activeTab: "ALL",
    search: "",
  }, {
    defaultViewName:
      userRole === "PURCHASER" ? "Purchasing queue" : userRole === "WAREHOUSE" ? "PO overview" : "Review queue",
    defaultViewState: {
      activeTab: "ALL",
      search: "",
    },
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  useToastFeedback(errorMessage, statusMessage);

  const tabs = [
    { key: "ALL", label: t("tabs.all") },
    { key: "DRAFT", label: t("tabs.draft") },
    { key: "PENDING_APPROVAL", label: t("tabs.pendingApproval") },
    { key: "APPROVED", label: t("tabs.approved") },
    { key: "ORDERED", label: t("tabs.ordered") },
    { key: "RECEIVING", label: t("tabs.receiving") },
    { key: "CLOSED", label: t("tabs.closed") },
  ];

  const filtered = useMemo(() => {
    let next = [...purchaseOrders];

    if (filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      next = next.filter((po) =>
        `${po.poNumber} ${po.vendorName} ${po.createdBy}`.toLowerCase().includes(query)
      );
    }

    if (filters.activeTab !== "ALL") {
      if (filters.activeTab === "RECEIVING") {
        next = next.filter((po) =>
        ["PARTIALLY_RECEIVED", "RECEIVED"].includes(po.status)
        );
      } else if (filters.activeTab === "CLOSED") {
        next = next.filter((po) =>
        ["CLOSED", "CANCELLED"].includes(po.status)
        );
      } else {
        next = next.filter((po) => po.status === filters.activeTab);
      }
    }

    return next;
  }, [filters.activeTab, filters.search, purchaseOrders]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((po) => selectedIds.includes(po.id));

  const saveCurrentView = () => {
    const name = window.prompt("Save this purchase-order filter view as:");
    if (!name) {
      return;
    }
    saveView(name);
  };

  const bulkUpdate = async (
    action: "SUBMIT" | "APPROVE" | "REJECT" | "MARK_ORDERED" | "CANCEL"
  ) => {
    if (selectedIds.length === 0) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");

    const response = await fetch("/api/purchase-orders/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setErrorMessage(payload.error ?? "Failed to update purchase orders.");
      return;
    }

    setStatusMessage(payload.message ?? "Purchase orders updated.");
    setSelectedIds([]);
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-6 lg:p-8">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          {canManage && (
            <Link
              href={`/${locale}/purchase-orders/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              {t("newPurchaseOrder")}
            </Link>
          )}
        </div>

        {views.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Saved views
              </span>
              {views.map((view) => (
                <div
                  key={view.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => setFilters(view.state)}
                    className="text-xs font-semibold text-slate-700"
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteView(view.id)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={resetState}
                className="rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={saveCurrentView}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 hover:bg-slate-50"
              >
                Save view
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[2fr_1fr]">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Search
            </span>
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="PO number, vendor, or creator"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, activeTab: "ALL" }))}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              All
            </button>
            {tabs.slice(1).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, activeTab: tab.key }))}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filters.activeTab === tab.key
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-slate-600">
              {selectedIds.length} selected
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void bulkUpdate("SUBMIT")}
                disabled={!canManage}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => void bulkUpdate("APPROVE")}
                disabled={!canApprove}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void bulkUpdate("MARK_ORDERED")}
                disabled={!canManage}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Mark ordered
              </button>
              <button
                type="button"
                onClick={() => void bulkUpdate("CANCEL")}
                disabled={!canManage}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, ...filtered.map((po) => po.id)]))
                            : current.filter((id) => !filtered.some((po) => po.id === id))
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                    />
                  </th>
                  <th className="px-4 py-3">{t("columns.po")}</th>
                  <th className="px-4 py-3">{t("columns.vendor")}</th>
                  <th className="px-4 py-3">{t("columns.status")}</th>
                  <th className="px-4 py-3">{t("columns.orderDate")}</th>
                  <th className="px-4 py-3">{t("columns.expectedDate")}</th>
                  <th className="px-4 py-3">{t("columns.total")}</th>
                  <th className="px-4 py-3">{t("columns.createdBy")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                      {t("noMatch")}
                    </td>
                  </tr>
                ) : (
                  filtered.map((po) => (
                    <tr key={po.id} className={`hover:bg-slate-50 ${selectedIds.includes(po.id) ? "bg-indigo-50/60" : ""}`}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(po.id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? Array.from(new Set([...current, po.id]))
                                : current.filter((id) => id !== po.id)
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                        />
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        <Link href={`/${locale}/purchase-orders/${po.id}`}>
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4">{po.vendorName}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPoStatusTone(
                            po.status
                          )}`}
                        >
                          {t(`status.${po.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-4">{po.orderDate}</td>
                      <td className="px-4 py-4">{po.expectedDate}</td>
                      <td className="px-4 py-4">${po.totalCost}</td>
                      <td className="px-4 py-4">{po.createdBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


