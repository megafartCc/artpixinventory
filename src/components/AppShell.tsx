"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  MapPin,
  Settings,
  Truck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  ArrowLeftRight,
  Cog,
  Home,
  Boxes,
  Users,
  FileText,
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
  { key: "settings", href: "/settings", icon: Settings },
];

const mobileNavItems = [
  { key: "dashboard", href: "/", icon: Home },
  { key: "stock", href: "/stock", icon: Boxes },
  { key: "products", href: "/products", icon: Package },
  { key: "transfers", href: "/transfers", icon: ArrowLeftRight },
  { key: "settings", href: "/settings", icon: Settings },
];

export function AppShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const t = useTranslations("Navigation");
  const { data: session } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleBadgeColor: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
    MANAGER: "bg-blue-100 text-blue-700 border-blue-200",
    PURCHASER: "bg-amber-100 text-amber-700 border-amber-200",
    WAREHOUSE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  const role = (session?.user as { role?: string })?.role || "WAREHOUSE";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col border-r border-slate-200 bg-white
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[68px]" : "w-[240px]"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-slate-100">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            {!collapsed && (
              <span className="font-semibold text-slate-800 whitespace-nowrap">
                ArtPix 3D
              </span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={`/${locale}${item.href}`}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }
                `}
                title={collapsed ? t(item.key) : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{t(item.key)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-slate-100 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <div className="hidden lg:block" />

          {/* Right side: locale switch + profile */}
          <div className="flex items-center gap-3">
            {/* Locale Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              {["en", "ru", "uk"].map((loc) => (
                <Link
                  key={loc}
                  href={`/${loc}${pathname}`}
                  className={`
                    px-2.5 py-1 rounded-md text-xs font-medium transition-all
                    ${
                      locale === loc
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }
                  `}
                >
                  {loc.toUpperCase()}
                </Link>
              ))}
            </div>

            {/* Profile badge */}
            {session?.user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-slate-700 leading-tight">
                    {session.user.name}
                  </p>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${roleBadgeColor[role]}`}
                  >
                    {role}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                  className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 shadow-lg">
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={`/${locale}${item.href}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100"
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-2 z-50">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={`/${locale}${item.href}`}
                className={`
                  flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${
                    isActive
                      ? "text-indigo-600"
                      : "text-slate-400 hover:text-slate-600"
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
