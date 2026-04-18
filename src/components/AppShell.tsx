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
  { key: "settings", href: "/settings", icon: Settings },
];

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

const roleBadgeColor: Record<string, string> = {
  ADMIN: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700",
  MANAGER: "border-sky-200 bg-sky-100 text-sky-700",
  PURCHASER: "border-amber-200 bg-amber-100 text-amber-700",
  WAREHOUSE: "border-emerald-200 bg-emerald-100 text-emerald-700",
};

function LocaleFlag({ locale }: { locale: string }) {
  return (
    <span
      className="relative h-5 w-5 overflow-hidden rounded-full border border-slate-200 shadow-sm"
      aria-hidden="true"
    >
      {locale === "en" ? (
        <>
          <span className="absolute inset-0 bg-[repeating-linear-gradient(180deg,#dc2626_0_14%,#ffffff_14%_28%)]" />
          <span className="absolute left-0 top-0 h-[58%] w-[58%] bg-[#1d4ed8]" />
          <span className="absolute left-[14%] top-[16%] h-1 w-1 rounded-full bg-white shadow-[3px_0_0_0_white,6px_0_0_0_white,0_3px_0_0_white,3px_3px_0_0_white,6px_3px_0_0_white]" />
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
}: {
  children: React.ReactNode;
  locale: string;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const role = (session?.user as { role?: string })?.role || "WAREHOUSE";
  const roleClassName = roleBadgeColor[role] ?? roleBadgeColor.WAREHOUSE;
  const currentLocale =
    localeOptions.find((option) => option.value === locale) ?? localeOptions[0];

  const searchItems = [
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
  const filteredSearchItems = (
    normalizedSearch
      ? searchItems.filter((item) =>
          `${item.label} ${item.keywords.join(" ")}`.toLowerCase().includes(normalizedSearch)
        )
      : searchItems
  ).slice(0, 8);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (localeMenuRef.current && !localeMenuRef.current.contains(target)) {
        setLocaleMenuOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
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
    setSearchOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

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
        <div className="flex h-16 items-center border-b border-slate-100 px-4">
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

        <div className="border-t border-slate-100 p-2">
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex-shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-3 lg:grid lg:grid-cols-[auto,minmax(320px,560px),auto] lg:gap-4">
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
                  placeholder="Search pages"
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
                                {item.href === "/" ? "/dashboard" : item.href}
                              </span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                              Go
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-5 text-sm text-slate-500">
                        No matching pages found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
