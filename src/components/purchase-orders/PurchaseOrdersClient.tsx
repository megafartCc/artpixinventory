"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  canManagePurchaseOrders,
} from "@/lib/permissions";
import {
  formatPoStatus,
  getPoStatusTone,
} from "@/lib/purchase-order-utils";

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
  const { data: session } = useSession();
  const canManage = canManagePurchaseOrders(session?.user?.role);
  const [activeTab, setActiveTab] = useState("ALL");

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
    if (activeTab === "ALL") {
      return purchaseOrders;
    }

    if (activeTab === "RECEIVING") {
      return purchaseOrders.filter((po) =>
        ["PARTIALLY_RECEIVED", "RECEIVED"].includes(po.status)
      );
    }

    if (activeTab === "CLOSED") {
      return purchaseOrders.filter((po) =>
        ["CLOSED", "CANCELLED"].includes(po.status)
      );
    }

    return purchaseOrders.filter((po) => po.status === activeTab);
  }, [activeTab, purchaseOrders]);

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
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

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
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
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                      {t("noMatch")}
                    </td>
                  </tr>
                ) : (
                  filtered.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50">
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
