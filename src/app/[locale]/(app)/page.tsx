import { unstable_noStore as noStore } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  FileText,
  Package,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { RecentActivityPanel } from "@/components/dashboard/RecentActivityPanel";
import prisma from "@/lib/prisma";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatRelativeSync(value: Date | null, t: (key: string, values?: Record<string, string | number | Date>) => string) {
  if (!value) return t("notSynced");
  const minutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minAgo", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { hours });
  return t("daysAgo", { days: Math.floor(hours / 24) });
}

function getLowStockSeverity(minStock: number, quantity: number) {
  if (quantity <= 0) return "critical";
  if (minStock > 0 && quantity <= Math.ceil(minStock * 0.5)) return "high";
  return "watch";
}

function daysOverdue(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24)));
}

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  noStore();
  const t = await getTranslations({ locale: params.locale, namespace: "Dashboard" });
  const common = await getTranslations({ locale: params.locale, namespace: "Common" });
  const today = startOfToday();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalProducts,
    allStockRows,
    openPoCount,
    pendingApprovals,
    pendingDefects,
    overduePos,
    wrongLocationEvents,
    recentActivity,
    activeCounts,
    activeTransfers,
    todayReceipts,
    latestProductionSync,
    latestReasonSync,
    mappedProducts,
    mappedMachines,
    erpixFailures,
  ] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.stockLevel.findMany({
      where: { product: { active: true } },
      include: {
        product: { select: { compoundId: true, name: true, minStock: true } },
        location: { select: { name: true } },
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
      },
    }),
    prisma.purchaseOrder.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.defectReport.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.purchaseOrder.findMany({
      where: {
        expectedDate: { not: null, lt: new Date() },
        status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
      },
      include: { vendor: { select: { name: true } } },
      orderBy: { expectedDate: "asc" },
      take: 8,
    }),
    prisma.machineConsumption.findMany({
      where: { isCorrectLocation: false },
      include: {
        machine: { select: { name: true } },
        product: { select: { compoundId: true } },
      },
      orderBy: { consumedAt: "desc" },
      take: 8,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
      take: 20,
    }),
    prisma.countSession.count({ where: { status: { in: ["IN_PROGRESS", "SUBMITTED", "REVIEWING"] } } }),
    prisma.transfer.count({ where: { status: { in: ["COLLECTING", "DROPPING"] } } }),
    prisma.receivingItem.aggregate({
      where: { receivingSession: { completedAt: { gte: today } } },
      _sum: { receivedQty: true },
      _count: { id: true },
    }),
    prisma.productionQueueItem.findFirst({
      orderBy: { erpixSyncedAt: "desc" },
      select: { erpixSyncedAt: true },
    }),
    prisma.defectReason.findFirst({
      where: { syncedAt: { not: null } },
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true },
    }),
    prisma.product.count({ where: { erpixId: { not: null } } }),
    prisma.machine.count({ where: { erpixMachineId: { not: null } } }),
    prisma.notification.count({
      where: {
        type: "ERPIX_SYNC_FAILURE",
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  const localeMap: Record<string, string> = {
    en: "en-US",
    ru: "ru-RU",
    ua: "uk-UA",
  };

  const dateFormatter = new Intl.DateTimeFormat(localeMap[params.locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const dateTimeFormatter = new Intl.DateTimeFormat(localeMap[params.locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lowStockRows = allStockRows
    .filter((row) => row.quantity <= row.product.minStock)
    .sort((a, b) => a.quantity - b.quantity);
  const lowStockAlerts = lowStockRows.slice(0, 8);
  const lowStockSeverity = lowStockRows.reduce(
    (acc, row) => {
      acc[getLowStockSeverity(row.product.minStock, row.quantity)] += 1;
      return acc;
    },
    { critical: 0, high: 0, watch: 0 }
  );

  const poAgingBuckets = overduePos.reduce(
    (acc, po) => {
      if (!po.expectedDate) return acc;
      const overdueDays = daysOverdue(po.expectedDate);
      if (overdueDays <= 3) {
        acc.short += 1;
      } else if (overdueDays <= 7) {
        acc.medium += 1;
      } else {
        acc.long += 1;
      }
      return acc;
    },
    { short: 0, medium: 0, long: 0 }
  );

  const recentActivityItems = recentActivity.slice(0, 10);
  const todayReceiptQty = todayReceipts._sum.receivedQty ?? 0;
  const todayReceiptLines = todayReceipts._count.id;

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 px-1 sm:px-2 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 sm:text-base">
              {t("description")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t("totalProducts")}
            value={String(totalProducts)}
            icon={Package}
            iconClassName="bg-slate-900 text-white"
          />
          <StatCard
            title={t("lowStock")}
            value={String(lowStockRows.length)}
            icon={Boxes}
            iconClassName="bg-amber-100 text-amber-700"
          />
          <StatCard
            title={t("openPos")}
            value={String(openPoCount)}
            icon={FileText}
            iconClassName="bg-sky-100 text-sky-700"
          />
          <StatCard
            title={t("pendingDefects")}
            value={String(pendingDefects)}
            icon={AlertTriangle}
            iconClassName="bg-rose-100 text-rose-700"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <InsightCard
            title={t("lowStockSeverityTitle")}
            subtitle={t("lowStockSeveritySubtitle")}
            icon={ShieldAlert}
            iconClassName="bg-rose-100 text-rose-700"
            metrics={[
              { label: t("critical"), value: String(lowStockSeverity.critical) },
              { label: t("high"), value: String(lowStockSeverity.high) },
              { label: t("watch"), value: String(lowStockSeverity.watch) },
            ]}
          />
          <InsightCard
            title={t("overduePoAgingTitle")}
            subtitle={t("overduePoAgingSubtitle")}
            icon={ClipboardCheck}
            iconClassName="bg-amber-100 text-amber-700"
            metrics={[
              { label: t("days1to3"), value: String(poAgingBuckets.short) },
              { label: t("days4to7"), value: String(poAgingBuckets.medium) },
              { label: t("days8plus"), value: String(poAgingBuckets.long) },
            ]}
          />
          <InsightCard
            title={t("todayAndApprovalsTitle")}
            subtitle={t("todayAndApprovalsSubtitle")}
            icon={Truck}
            iconClassName="bg-emerald-100 text-emerald-700"
            metrics={[
              { label: t("receivedQty"), value: String(todayReceiptQty) },
              { label: t("receiptLines"), value: String(todayReceiptLines) },
              { label: t("pendingApprovals"), value: String(pendingApprovals) },
            ]}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)]">
          <DashboardPanel title={t("erpixSyncHealth")}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SyncHealthCard
                label={t("productionQueue")}
                value={formatRelativeSync(latestProductionSync?.erpixSyncedAt ?? null, common)}
              />
              <SyncHealthCard
                label={t("defectReasons")}
                value={formatRelativeSync(latestReasonSync?.syncedAt ?? null, common)}
              />
              <SyncHealthCard
                label={t("mappedProducts")}
                value={`${mappedProducts}/${totalProducts}`}
              />
              <SyncHealthCard
                label={t("sevenDayFailures")}
                value={String(erpixFailures)}
                alert={erpixFailures > 0}
              />
            </div>
          </DashboardPanel>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("approvalsAndReceipts")}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <ActiveMetricCard title={t("pendingApprovals")} value={String(pendingApprovals)} icon={ClipboardCheck} />
              <ActiveMetricCard title={t("todayReceipts")} value={String(todayReceiptQty)} icon={Truck} />
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-3">
                <SummaryRow label={t("openPos")} value={String(openPoCount)} />
                <SummaryRow label={t("pendingDefects")} value={String(pendingDefects)} />
                <SummaryRow label={t("overduePo")} value={String(overduePos.length)} />
                <SummaryRow label={t("wrongLocationEvents")} value={String(wrongLocationEvents.length)} />
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <DashboardPanel title={t("lowStockItems")}>
            {lowStockAlerts.length === 0 ? (
              <EmptyState message={t("noLowStockAlerts")} />
            ) : (
              lowStockAlerts.map((row) => (
                <DashboardListItem
                  key={row.id}
                  title={`${row.product.compoundId} / ${row.location.name}`}
                  detail={`${t("qty")} ${row.quantity} / ${t("min")} ${row.product.minStock}`}
                />
              ))
            )}
          </DashboardPanel>

          <DashboardPanel title={t("overduePo")}>
            {overduePos.length === 0 ? (
              <EmptyState message={t("noOverduePo")} />
            ) : (
              overduePos.map((po) => (
                <DashboardListItem
                  key={po.id}
                  title={`${po.poNumber} / ${po.vendor.name}`}
                  detail={`${t("expected")} ${po.expectedDate ? dateFormatter.format(po.expectedDate) : "-"}`}
                />
              ))
            )}
          </DashboardPanel>

          <DashboardPanel title={t("wrongLocationEvents")}>
            {wrongLocationEvents.length === 0 ? (
              <EmptyState message={t("noWrongLocationEvents")} />
            ) : (
              wrongLocationEvents.map((event) => (
                <DashboardListItem
                  key={event.id}
                  title={`${event.machine.name} / ${event.product.compoundId}`}
                  detail={`${t("qty")} ${event.quantity}`}
                />
              ))
            )}
          </DashboardPanel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
          <RecentActivityPanel
            title={t("recentActivity")}
            description={t("description")}
            searchPlaceholder={t("recentActivitySearch")}
            emptyMessage={t("noRecentActivityMatch")}
            items={recentActivityItems.map((entry) => ({
              id: entry.id,
              action: entry.action,
              entityType: entry.entityType,
              actor: `${t("by")} ${entry.user?.name ?? t("system")}`,
              timestamp: `${t("at")} ${dateTimeFormatter.format(entry.createdAt)}`,
            }))}
          />

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">{t("activeOps")}</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <ActiveMetricCard
                title={t("activeCountSessions")}
                value={String(activeCounts)}
                icon={Boxes}
              />
              <ActiveMetricCard
                title={t("activeTransfers")}
                value={String(activeTransfers)}
                icon={ArrowLeftRight}
              />
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-3">
                <SummaryRow label={t("pendingApprovals")} value={String(pendingApprovals)} />
                <SummaryRow label={t("todayReceiptLines")} value={String(todayReceiptLines)} />
                <SummaryRow label={t("mappedMachines")} value={String(mappedMachines)} />
                <SummaryRow label={t("erpixFailures7d")} value={String(erpixFailures)} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconClassName: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 sm:min-h-[170px] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-[12rem] text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
          {title}
        </p>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-10 text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function InsightCard({
  title,
  subtitle,
  metrics,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string }>;
  icon: React.ElementType;
  iconClassName: string;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {metric.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

function DashboardListItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function ActiveMetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-8 text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SyncHealthCard({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${alert ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-3 text-lg font-semibold ${alert ? "text-rose-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
