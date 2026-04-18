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
  { key: "labels", href: "/labels", icon: Printer },
  { key: "production", href: "/production", icon: Factory },
  { key: "credits", href: "/credits", icon: Receipt },
  { key: "reports", href: "/reports", icon: BarChart3 },
];

const settingsNavItem = { key: "settings", href: "/settings", icon: Settings };

const mobileNavItems = [
  { key: "dashboard", href: "/", icon: Home },
  { key: "stock", href: "/stock", icon: Boxes },
  { key: "products", href: "/products", icon: Package },
  { key: "transfers", href: "/transfers", icon: ArrowLeftRight },
  { key: "settings", href: "/settings", icon: Settings },
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

const roleBadgeColor: Record<string, string> = {
  ADMIN: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700",
  MANAGER: "border-sky-200 bg-sky-100 text-sky-700",
  PURCHASER: "border-amber-200 bg-amber-100 text-amber-700",
  WAREHOUSE: "border-emerald-200 bg-emerald-100 text-emerald-700",
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

  const role = (session?.user as { role?: string })?.role || "WAREHOUSE";
  const roleClassName = roleBadgeColor[role] ?? roleBadgeColor.WAREHOUSE;
  const currentLocale =
    localeOptions.find((option) => option.value === locale) ?? localeOptions[0];

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
    { label: t("labels"), href: "/labels", keywords: ["print", "zpl", "barcode"] },
    { label: t("production"), href: "/production", keywords: ["restock", "queue", "machine"] },
    { label: t("credits"), href: "/credits", keywords: ["vendor credits", "claims", "refunds"] },
    { label: t("reports"), href: "/reports", keywords: ["analytics", "insights"] },
    { label: t("settings"), href: "/settings", keywords: ["config", "admin", "system"] },
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
            {navItems.map((item) => {
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
        <header className="flex min-h-[4rem] h-auto flex-shrink-0 items-center border-b border-slate-200 bg-white px-3 py-3 sm:px-4 lg:h-16 lg:px-6 lg:py-0">
          <div className="flex w-full flex-wrap items-center gap-3 lg:grid lg:grid-cols-[auto,minmax(320px,560px),auto] lg:gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            <div ref={searchRef} className="order-3 w-full lg:order-none lg:w-auto">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
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
                  placeholder="Search inventory"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
                />
                {searchOpen && (
                  <div className="absolute inset-x-0 top-[calc(100%+10px)] z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                    {filteredSearchItems.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto p-2">
                        {filteredSearchItems.map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => navigateFromSearch(item.href)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
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
                      <div className="px-4 py-5 text-sm text-slate-500">
                        No matching pages found.
                      </div>
                    )}
                    {searchLoading && (
                      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-400">
                        Searching...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div ref={notificationMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationOpen((current) => !current)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {notificationItems.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                      {notificationItems.length}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[320px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">Notifications</p>
                      <p className="mt-1 text-xs text-slate-500">Alerts and operational attention items.</p>
                    </div>
                    <div className="mt-1 space-y-1">
                      {notificationItems.length === 0 ? (
                        <div className="rounded-lg px-3 py-4 text-sm text-slate-500">
                          No alerts right now.
                        </div>
                      ) : (
                        notificationItems.map((item) => (
                          <Link
                            key={item.id}
                            href={`/${locale}${item.href}`}
                            className="flex items-start gap-3 rounded-lg px-3 py-3 transition hover:bg-slate-50"
                          >
                            <span
                              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                                item.tone === "rose"
                                  ? "bg-rose-500"
                                  : item.tone === "amber"
                                    ? "bg-amber-500"
                                    : "bg-slate-400"
                              }`}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-800">
                                {item.title}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {item.detail}
                              </span>
                            </span>
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
                <>
                  <div ref={accountMenuRef} className="relative">
                    <div className="flex items-center gap-2">
                      <div className="hidden min-w-[104px] flex-col items-center justify-center gap-1 text-center sm:flex">
                        <p className="text-base font-semibold leading-none text-slate-800">
                          {session.user.name}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${roleClassName}`}
                        >
                          {role}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAccountMenuOpen((current) => !current)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                        aria-label="Account"
                      >
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            accountMenuOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                    {accountMenuOpen && (
                      <div className="absolute right-0 top-[calc(100%+10px)] z-40 min-w-[200px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
                        <div className="rounded-lg bg-slate-50 px-3 py-3 sm:hidden">
                          <p className="text-sm font-semibold text-slate-800">
                            {session.user.name}
                          </p>
                          <span
                            className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${roleClassName}`}
                          >
                            {role}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-600 sm:mt-0"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white shadow-lg lg:hidden">
            <nav className="space-y-1 p-3">
              {navItems.map((item) => {
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
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

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
