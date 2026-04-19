"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";

type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  actor: string;
  timestamp: string;
};

export function RecentActivityPanel({
  title,
  description,
  searchPlaceholder,
  emptyMessage,
  items,
}: {
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyMessage: string;
  items: ActivityItem[];
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredItems = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) =>
      [item.action, item.entityType, item.actor, item.timestamp]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [deferredQuery, items]);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <label className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
          />
        </label>
      </div>

      <div className="mt-5 max-h-[760px] space-y-3 overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          filteredItems.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3"
            >
              <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {entry.action} / {entry.entityType}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.actor} / {entry.timestamp}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
