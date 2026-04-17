import Link from "next/link";

const reportLinks = [
  { href: "stock-levels", title: "Stock Levels", description: "Current stock by location, index, and category." },
  { href: "po-aging", title: "PO Aging", description: "Open purchase orders, age, and overdue visibility." },
  { href: "defects", title: "Defects", description: "Defect trends and vendor/internal split." },
  { href: "production", title: "Production Daily", description: "Machine consumption with defect rate." },
  { href: "qbo-export", title: "QBO Export", description: "CSV export for accounting and inventory cost flow." },
];

export default function ReportsHubPage({ params }: { params: { locale: string } }) {
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="mt-1 text-slate-500">Select a report below.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {reportLinks.map((report) => (
            <Link
              key={report.href}
              href={`/${params.locale}/reports/${report.href}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
            >
              <h2 className="text-lg font-semibold text-slate-900">{report.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{report.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
