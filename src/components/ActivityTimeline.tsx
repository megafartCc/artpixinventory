"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowLeftRight, CheckCircle2, FileText, Package, Truck, User } from "lucide-react";

type ActivityLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: unknown;
  createdAt: string;
  user: {
    name: string;
    email: string;
    role: string;
  } | null;
};

function getActionIcon(action: string) {
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes("create") || lowerAction.includes("add")) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (lowerAction.includes("delete") || lowerAction.includes("remove") || lowerAction.includes("cancel")) return <AlertTriangle className="h-4 w-4 text-rose-500" />;
  if (lowerAction.includes("transfer") || lowerAction.includes("move")) return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
  if (lowerAction.includes("receive")) return <Truck className="h-4 w-4 text-indigo-500" />;
  if (lowerAction.includes("update") || lowerAction.includes("edit")) return <FileText className="h-4 w-4 text-amber-500" />;
  if (lowerAction.includes("adjust")) return <Package className="h-4 w-4 text-fuchsia-500" />;
  return <Activity className="h-4 w-4 text-slate-500" />;
}

function getActionColor(action: string) {
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes("create") || lowerAction.includes("add")) return "bg-emerald-50 border-emerald-200";
  if (lowerAction.includes("delete") || lowerAction.includes("remove") || lowerAction.includes("cancel")) return "bg-rose-50 border-rose-200";
  if (lowerAction.includes("transfer") || lowerAction.includes("move")) return "bg-blue-50 border-blue-200";
  if (lowerAction.includes("receive")) return "bg-indigo-50 border-indigo-200";
  if (lowerAction.includes("update") || lowerAction.includes("edit")) return "bg-amber-50 border-amber-200";
  if (lowerAction.includes("adjust")) return "bg-fuchsia-50 border-fuchsia-200";
  return "bg-slate-50 border-slate-200";
}

function formatTimeAgo(dateInput: string | Date) {
  const date = new Date(dateInput);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityTimeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const res = await fetch(`/api/activity?entityType=${entityType}&entityId=${entityId}`);
        if (!res.ok) throw new Error("Failed to fetch activity logs");
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err));
        }
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
        Error loading timeline: {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
        <Activity className="mb-2 h-6 w-6 text-slate-300" />
        No recent activity found.
      </div>
    );
  }

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:border-l-2 before:border-slate-200 md:before:mx-auto md:before:translate-x-0">
      {logs.map((log) => (
        <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            {getActionIcon(log.action)}
          </div>
          
          <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] rounded-2xl border ${getActionColor(log.action)} p-4 shadow-sm`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                {Boolean(log.details) && (
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                  </p>
                )}
              </div>
              <time className="shrink-0 text-xs text-slate-500 whitespace-nowrap">
                {formatTimeAgo(log.createdAt)}
              </time>
            </div>
            
            {log.user && (
              <div className="mt-3 flex items-center gap-2 border-t border-slate-200/60 pt-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200">
                  <User className="h-3 w-3 text-slate-500" />
                </div>
                <span className="text-xs font-medium text-slate-700">{log.user.name}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase border border-slate-200/60">
                  {log.user.role}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
