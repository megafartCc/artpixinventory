"use client";

import { useTranslations } from "next-intl";

function DashboardContent() {
  const t = useTranslations("Dashboard");
  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          {t("title")}
        </h1>
        <p className="text-slate-500 mt-1 mb-8">{t("description")}</p>

        {/* Quick stats placeholder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Products", value: "10", color: "from-indigo-500 to-purple-500" },
            { label: "Locations", value: "15", color: "from-emerald-500 to-teal-500" },
            { label: "Machines", value: "44", color: "from-amber-500 to-orange-500" },
            { label: "Open POs", value: "0", color: "from-rose-500 to-pink-500" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Activity feed placeholder */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Recent Activity</h2>
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Activity feed will appear here once operations begin.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
