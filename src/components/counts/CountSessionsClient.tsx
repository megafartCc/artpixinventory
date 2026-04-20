"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { useSavedViews } from "@/hooks/useSavedViews";

type CountRow = {
  id: string;
  name: string;
  locationName: string;
  type: string;
  status: string;
  assignedToName: string | null;
  startedAt: string;
  varianceCount: number;
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "SUBMITTED" || status === "REVIEWING") return "bg-amber-100 text-amber-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-500";
  return "bg-blue-100 text-blue-700";
}

export function CountSessionsClient({
  locale,
  rows,
  canCreate,
}: {
  locale: string;
  rows: CountRow[];
  canCreate: boolean;
}) {
  const t = useTranslations("Counts");
  const userRole = canCreate ? "WAREHOUSE" : "MANAGER";
  const {
    state: filters,
    setState: setFilters,
    views,
    saveView,
    deleteView,
    resetState,
  } = useSavedViews("artpix:counts:list", {
    search: "",
    statusFilter: "ALL",
  }, {
    defaultViewName: userRole === "WAREHOUSE" ? "My counts" : "Count overview",
    defaultViewState: {
      search: "",
      statusFilter: "ALL",
    },
  });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [duplicatingId, setDuplicatingId] = useState("");
  useToastFeedback(error, feedback);

  const filteredRows = useMemo(() => {
    let next = [...rows];
    if (filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      next = next.filter((row) =>
        `${row.name} ${row.locationName} ${row.assignedToName ?? ""}`.toLowerCase().includes(query)
      );
    }

    if (filters.statusFilter !== "ALL") {
      next = next.filter((row) => row.status === filters.statusFilter);
    }

    return next;
  }, [filters.search, filters.statusFilter, rows]);

  const saveCurrentView = () => {
    const name = window.prompt("Save this count filter view as:");
    if (!name) {
      return;
    }

    saveView(name);
  };

  const duplicate = async (id: string) => {
    setDuplicatingId(id);
    setError("");
    setFeedback("");

    const response = await fetch(`/api/counts/${id}/duplicate`, {
      method: "POST",
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      data?: { id: string };
    };

    setDuplicatingId("");

    if (!response.ok || !payload.data) {
      setError(payload.error ?? t("errors.duplicateFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.duplicated"));
    window.location.href = `/${locale}/counts/${payload.data.id}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-6 lg:p-8">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">{t("subtitle")}</p>
          </div>
          {canCreate && (
            <Link
              href={`/${locale}/counts/new`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800 lg:min-h-0 lg:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>{t("newCount")}</span>
            </Link>
          )}
        </div>

        {views.length > 0 && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
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
                onClick={saveCurrentView}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 hover:bg-slate-50"
              >
                Save view
              </button>
              <button
                type="button"
                onClick={resetState}
                className="rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[2fr_1fr]">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Search
            </span>
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Name, location, or assignee"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Status
            </span>
            <select
              value={filters.statusFilter}
              onChange={(event) =>
                setFilters((current) => ({ ...current, statusFilter: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            >
              <option value="ALL">All</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {filteredRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
              {t("empty")}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t("columns.name")}</th>
                    <th className="px-4 py-3">{t("columns.location")}</th>
                    <th className="px-4 py-3">{t("columns.type")}</th>
                    <th className="px-4 py-3">{t("columns.status")}</th>
                    <th className="px-4 py-3">{t("columns.assignedTo")}</th>
                    <th className="px-4 py-3">{t("columns.started")}</th>
                    <th className="px-4 py-3 text-right">{t("columns.variances")}</th>
                    <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/counts/${row.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.locationName}</td>
                      <td className="px-4 py-3">{row.type}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClass(row.status)}`}>
                          {formatStatus(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.assignedToName ?? "-"}</td>
                      <td className="px-4 py-3">{row.startedAt}</td>
                      <td className="px-4 py-3 text-right font-semibold">{row.varianceCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/${locale}/counts/${row.id}`}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50"
                          >
                            {row.status === "SUBMITTED" ? t("review") : t("open")}
                          </Link>
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => void duplicate(row.id)}
                              disabled={duplicatingId === row.id}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span>{t("duplicate")}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


