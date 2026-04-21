"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  Check,
  ClipboardCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cog,
  Factory,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Printer,
  Receipt,
  Scan,
  Search,
  Settings,
  Truck,
  Users,
  X,
} from "lucide-react";

const navItems = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "products", href: "/products", icon: Package },
  { key: "stock", href: "/stock", icon: Boxes },
  { key: "locations", href: "/locations", icon: MapPin },
  { key: "machines", href: "/machines", icon: Cog },
  { key: "vendors", href: "/vendors", icon: Users },
  { key: "purchaseOrders", href: "/purchase-orders", icon: FileText },
  { key: "receiving", href: "/receiving", icon: Truck },
  { key: "transfers", href: "/transfers", icon: ArrowLeftRight },
  { key: "defects", href: "/defects", icon: AlertTriangle },
  { key: "counts", href: "/counts", icon: ClipboardCheck },
  { key: "labels", href: "/labels", icon: Printer },
  { key: "production", href: "/production", icon: Factory },
  { key: "credits", href: "/credits", icon: Receipt },
  { key: "reports", href: "/reports", icon: BarChart3 },
];

const settingsNavItem = { key: "settings", href: "/settings", icon: Settings };

const mobileNavItems = [
  { key: "dashboard", href: "/", icon: Home },
  { key: "stock", href: "/stock", icon: Boxes },
  { key: "scan", href: "/counts", icon: Scan },
  { key: "transfers", href: "/transfers", icon: ArrowLeftRight },
  { key: "more", href: "#more", icon: Menu },
];

const localeOptions = [
  { value: "en", label: "ENG" },
  { value: "ru", label: "RU" },
  { value: "ua", label: "UA" },
];

type StaticSearchItem = {
  label: string;
  href: string;
  keywords: string[];
};

type EntitySearchItem = {
  label: string;
  href: string;
  keywords: string[];
  subtitle: string;
  kind: string;
};


function LocaleFlag({ locale }: { locale: string }) {
  const usRows = [
    0, 14, 28, 42, 56, 70, 84,
  ];

  return (
    <span
      className="relative h-5 w-5 overflow-hidden rounded-full border border-slate-200 shadow-sm"
      aria-hidden="true"
    >
      {locale === "en" ? (
        <>
          <span className="absolute inset-0 bg-white" />
          {usRows.map((top) => (
            <span
              key={top}
              className="absolute left-0 right-0 bg-[#b22234]"
              style={{ top: `${top}%`, height: "8%" }}
            />
          ))}
          <span className="absolute left-0 top-0 h-[54%] w-[58%] bg-[#3c3b6e]" />
          <span className="absolute left-[10%] top-[10%] h-[6%] w-[6%] rounded-full bg-white shadow-[3px_0_0_0_white,6px_0_0_0_white,9px_0_0_0_white,12px_0_0_0_white,0_4px_0_0_white,3px_4px_0_0_white,6px_4px_0_0_white,9px_4px_0_0_white,12px_4px_0_0_white,0_8px_0_0_white,3px_8px_0_0_white,6px_8px_0_0_white,9px_8px_0_0_white,12px_8px_0_0_white]" />
        </>
      ) : locale === "ru" ? (
        <span className="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_33%,#2563eb_33%,#2563eb_66%,#dc2626_66%,#dc2626_100%)]" />
      ) : (
        <span className="absolute inset-0 bg-[linear-gradient(180deg,#2563eb_0%,#2563eb_50%,#facc15_50%,#facc15_100%)]" />
      )}
    </span>
  );
}

export function AppShell({
  children,
  locale,
  notificationItems,
}: {
  children: React.ReactNode;
  locale: string;
  notificationItems: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
    tone: "amber" | "rose" | "slate";
  }>;
}) {
  const t = useTranslations("Navigation");
  const reportsStock = useTranslations("ReportsStockLevels");
  const reportsPoAging = useTranslations("ReportsPoAging");
  const reportsProduction = useTranslations("ReportsProduction");
  const reportsDefects = useTranslations("ReportsDefects");
  const reportsQbo = useTranslations("ReportsQbo");
  const appShell = useTranslations("AppShell");
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityResults, setEntityResults] = useState<Array<{
    id: string;
    label: string;
    subtitle: string;
    href: string;
    kind: string;
  }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const role = (session?.user as { role?: string })?.role || "WAREHOUSE";
  const canAccessSettings = role === "ADMIN";
  const currentLocale =
    localeOptions.find((option) => option.value === locale) ?? localeOptions[0];
  const visibleNavItems = canAccessSettings
    ? navItems
    : navItems.filter((item) => item.key !== "settings");

  const searchItems: StaticSearchItem[] = [
    { label: t("dashboard"), href: "/", keywords: ["home", "overview", "panel"] },
    { label: t("products"), href: "/products", keywords: ["catalog", "items", "sku"] },
    { label: t("stock"), href: "/stock", keywords: ["inventory", "levels", "quantity"] },
    { label: t("locations"), href: "/locations", keywords: ["warehouse", "bins", "shelves"] },
    { label: t("machines"), href: "/machines", keywords: ["equipment", "printers", "production"] },
    { label: t("vendors"), href: "/vendors", keywords: ["suppliers", "partners"] },
    { label: t("purchaseOrders"), href: "/purchase-orders", keywords: ["po", "purchasing", "orders"] },
    { label: t("receiving"), href: "/receiving", keywords: ["inbound", "pallets", "receiving"] },
    { label: t("transfers"), href: "/transfers", keywords: ["moves", "warehouse transfers"] },
    { label: t("defects"), href: "/defects", keywords: ["quality", "issues", "qc"] },
    { label: t("counts"), href: "/counts", keywords: ["cycle count", "blind count", "inventory count"] },
    { label: t("labels"), href: "/labels", keywords: ["print", "zpl", "barcode"] },
    { label: t("production"), href: "/production", keywords: ["restock", "queue", "machine"] },
    { label: t("credits"), href: "/credits", keywords: ["vendor credits", "claims", "refunds"] },
    { label: t("reports"), href: "/reports", keywords: ["analytics", "insights"] },
    {
      label: reportsStock("title"),
      href: "/reports/stock-levels",
      keywords: ["inventory report", "stock report"],
    },
    {
      label: reportsPoAging("title"),
      href: "/reports/po-aging",
      keywords: ["purchase order aging", "po aging"],
    },
    {
      label: reportsDefects("title"),
      href: "/reports/defects",
      keywords: ["quality report", "defect report"],
    },
    {
      label: reportsProduction("title"),
      href: "/reports/production",
      keywords: ["daily production report", "consumption"],
    },
    {
      label: reportsQbo("title"),
      href: "/reports/qbo-export",
      keywords: ["quickbooks", "csv export", "accounting"],
    },
  ];

  if (canAccessSettings) {
    searchItems.push({
      label: t("settings"),
      href: "/settings",
      keywords: ["config", "admin", "system"],
    });
  }

  searchItems.push({
    label: "Activity log",
    href: "/reports/activity",
    keywords: ["audit log", "history", "activity"],
  });

  const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
  const filteredPageItems: StaticSearchItem[] = (
    normalizedSearch
      ? searchItems.filter((item) =>
          `${item.label} ${item.keywords.join(" ")}`.toLowerCase().includes(normalizedSearch)
        )
      : searchItems
  ).slice(0, normalizedSearch ? 5 : 8);
  const filteredSearchItems: Array<StaticSearchItem | EntitySearchItem> = normalizedSearch
    ? [
        ...filteredPageItems,
        ...entityResults.map((item) => ({
          label: item.label,
          href: item.href,
          keywords: [item.kind, item.subtitle],
          subtitle: item.subtitle,
          kind: item.kind,
        })),
      ].slice(0, 10)
    : filteredPageItems;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (localeMenuRef.current && !localeMenuRef.current.contains(target)) {
        setLocaleMenuOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setNotificationOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isCommandK) {
        return;
      }

      event.preventDefault();
      setSearchOpen(true);
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setLocaleMenuOpen(false);
    setAccountMenuOpen(false);
    setNotificationOpen(false);
    setSearchOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const query = deferredSearchQuery.trim();
    if (query.length < 2) {
      setEntityResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setSearchLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Search failed");
        }
        const payload = (await response.json()) as {
          items: Array<{
            id: string;
            label: string;
            subtitle: string;
            href: string;
            kind: string;
          }>;
        };
        setEntityResults(payload.items);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setEntityResults([]);
        }
      })
      .finally(() => setSearchLoading(false));

    return () => controller.abort();
  }, [deferredSearchQuery]);

  const navigateFromSearch = (href: string) => {
    setSearchQuery("");
    setSearchOpen(false);
    router.push(`/${locale}${href}`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside
        className={`
          hidden lg:flex flex-col border-r border-slate-200 bg-white
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[68px]" : "w-[240px]"}
        `}
      >
        <div className="flex h-16 items-center border-b border-slate-200 px-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            {!collapsed && (
              <span className="whitespace-nowrap font-semibold text-slate-800">
                ArtPix 3D
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
            {visibleNavItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.key}
                  href={`/${locale}${item.href}`}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                    ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }
                  `}
                  title={collapsed ? t(item.key) : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{t(item.key)}</span>}
                </Link>
              );
            })}
          </nav>

          {canAccessSettings && (
            <div className="border-t border-slate-200 px-2 py-3">
              <Link
                href={`/${locale}${settingsNavItem.href}`}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                  ${
                    pathname.startsWith(settingsNavItem.href)
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }
                `}
                title={collapsed ? t(settingsNavItem.key) : undefined}
              >
                <settingsNavItem.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{t(settingsNavItem.key)}</span>}
              </Link>
            </div>
          )}

          <div className="border-t border-slate-200 p-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex w-full flex-col lg:h-16 lg:flex-row lg:items-center lg:px-6">
            <div className="flex h-16 shrink-0 items-center justify-between px-3 sm:px-4 lg:w-1/4 lg:px-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 shadow-sm">
                    <span className="text-xs font-bold text-white">A</span>
                  </div>
                  <span className="text-sm font-bold tracking-tight text-slate-800">ArtPix</span>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:hidden">
                <div ref={notificationMenuRef} className="relative">
                  <button
                    onClick={() => setNotificationOpen(!notificationOpen)}
                    className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <Bell className="h-5 w-5" />
                    {notificationItems.length > 0 && (
                      <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                    )}
                  </button>
                  {notificationOpen && (
                    <div className="absolute right-0 top-[calc(100%+10px)] w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                      <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                        <h3 className="text-sm font-bold text-slate-900">{appShell("notifications")}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{appShell("notificationsSubtitle")}</p>
                      </div>
                      <div className="max-h-96 overflow-y-auto p-2">
                        {notificationItems.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-slate-400">{appShell("noNotifications")}</div>
                        ) : (
                          notificationItems.map((item) => (
                            <Link
                              key={item.id}
                              href={`/${locale}${item.href}`}
                              onClick={() => setNotificationOpen(false)}
                              className="group flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50"
                            >
                              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                item.tone === "rose" ? "bg-rose-500" : item.tone === "amber" ? "bg-amber-500" : "bg-slate-400"
                              }`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600">{item.title}</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div ref={searchRef} className="flex-1 border-t border-slate-200 px-3 py-3 sm:px-4 lg:border-t-0 lg:mx-auto lg:max-w-[600px] lg:px-0 lg:py-0">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filteredSearchItems[0]) {
                      event.preventDefault();
                      navigateFromSearch(filteredSearchItems[0].href);
                    }
                    if (event.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  placeholder={appShell("searchPlaceholder")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100 lg:h-12 lg:pr-20"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 lg:block">
                  Ctrl K
                </kbd>
                {searchOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close command palette"
                      onClick={() => setSearchOpen(false)}
                      className="fixed inset-0 z-40 bg-slate-950/25"
                    />
                    <div className="fixed left-1/2 top-20 z-50 w-[min(92vw,760px)] -translate-x-1/2 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {appShell("searchPlaceholder")}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Ctrl K / Cmd K
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {searchLoading ? appShell("searching") : appShell("noResults")}
                        </span>
                      </div>
                      {filteredSearchItems.length > 0 ? (
                        <div className="max-h-[60vh] overflow-y-auto p-2">
                          {filteredSearchItems.map((item) => (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => navigateFromSearch(item.href)}
                              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                              <span>
                                <span className="block text-sm font-medium text-slate-800">
                                  {item.label}
                                </span>
                                <span className="block text-xs text-slate-400">
                                  {"subtitle" in item
                                    ? item.subtitle
                                    : item.href === "/"
                                      ? "/dashboard"
                                      : item.href}
                                </span>
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                {"kind" in item ? item.kind : "Go"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-5 py-8 text-sm text-slate-500">
                          {appShell("noResults")}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="hidden lg:flex lg:w-1/4 lg:items-center lg:justify-end lg:gap-3">
              <div ref={notificationMenuRef} className="relative">
                <button
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100"
                >
                  <Bell className="h-5 w-5" />
                  {notificationItems.length > 0 && (
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </button>
                {notificationOpen && (
                  <div className="absolute right-0 top-[calc(100%+10px)] w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                    <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                      <h3 className="text-sm font-bold text-slate-900">{appShell("notifications")}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{appShell("notificationsSubtitle")}</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-2">
                      {notificationItems.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">{appShell("noNotifications")}</div>
                      ) : (
                        notificationItems.map((item) => (
                          <Link
                            key={item.id}
                            href={`/${locale}${item.href}`}
                            onClick={() => setNotificationOpen(false)}
                            className="group flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50"
                          >
                            <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              item.tone === "rose" ? "bg-rose-500" : item.tone === "amber" ? "bg-amber-500" : "bg-slate-400"
                            }`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600">{item.title}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div ref={localeMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setLocaleMenuOpen((current) => !current)}
                  className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <LocaleFlag locale={currentLocale.value} />
                  <span>{currentLocale.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      localeMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {localeMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+10px)] z-40 min-w-[168px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
                    {localeOptions.map((option) => {
                      const active = option.value === locale;
                      return (
                        <Link
                          key={option.value}
                          href={`/${option.value}${pathname}`}
                          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                            active
                              ? "bg-slate-100 font-medium text-slate-900"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <LocaleFlag locale={option.value} />
                            <span>{option.label}</span>
                          </span>
                          {active && <Check className="h-4 w-4 text-slate-500" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {session?.user && (
                <div ref={accountMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex flex-col items-end text-right">
                      <span className="block text-xs font-bold leading-none text-slate-900">{session.user.name}</span>
                      <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">{role}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        accountMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {accountMenuOpen && (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-40 min-w-[200px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{appShell("signOut")}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white shadow-lg lg:hidden">
            <nav className="space-y-1 p-3">
              {visibleNavItems.map((item) => {
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.key}
                    href={`/${locale}${item.href}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                      ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100"
                      }
                    `}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
              {canAccessSettings && (
                <Link
                  href={`/${locale}${settingsNavItem.href}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    pathname.startsWith(settingsNavItem.href)
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <settingsNavItem.icon className="h-5 w-5" />
                  <span>{t(settingsNavItem.key)}</span>
                </Link>
              )}
            </nav>
          </div>
        )}

        <main className="min-h-0 flex flex-1 flex-col overflow-y-auto pb-32 lg:pb-0">
          <div className="flex h-full min-h-0 w-full flex-col">{children}</div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            if (item.key === "more") {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMobileMenuOpen((current) => !current)}
                  className={`
                    flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
                    ${
                      mobileMenuOpen
                        ? "text-indigo-600"
                        : "text-slate-400 hover:text-slate-600"
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{t(item.key)}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                href={`/${locale}${item.href}`}
                className={`
                  flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
                  ${
                    isActive
                      ? "text-indigo-600"
                      : "text-slate-400 hover:text-slate-600"
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}


