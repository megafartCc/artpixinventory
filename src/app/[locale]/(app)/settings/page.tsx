import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { DefectReasonsSectionClient } from "@/components/settings/DefectReasonsSectionClient";
import { SystemSettingsClient } from "@/components/settings/SystemSettingsClient";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/permissions";

const settingKeys = [
  "default_receiving_location",
  "po_number_prefix",
  "slack_webhook_inventory_alerts",
  "slack_webhook_purchasing",
  "slack_webhook_quality",
  "slack_webhook_warehouse_ops",
  "slack_webhook_system_errors",
] as const;

export default async function SettingsPage() {
  noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccessSettings(session.user.role)) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          Admin access is required to view settings.
        </div>
      </div>
    );
  }

  const [defectReasons, settings, locations] = await Promise.all([
    prisma.defectReason.findMany({
      where: { active: true },
      orderBy: [{ faultType: "asc" }, { name: "asc" }],
      select: { id: true, name: true, faultType: true, erpixReasonId: true },
    }),
    prisma.setting.findMany({
      where: { key: { in: settingKeys as unknown as string[] } },
      select: { key: true, value: true },
    }),
    prisma.location.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const map = Object.fromEntries(settings.map((entry) => [entry.key, entry.value]));
  const erpixMasked = process.env.ERPIX_API_KEY
    ? `${process.env.ERPIX_API_KEY.slice(0, 3)}***${process.env.ERPIX_API_KEY.slice(-3)}`
    : "Not configured";

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-slate-500">System configuration and lookup tables.</p>
        </div>

        <SystemSettingsClient
          initialValues={{
            default_receiving_location: map.default_receiving_location ?? "",
            po_number_prefix: map.po_number_prefix ?? "PO",
            slack_webhook_inventory_alerts: map.slack_webhook_inventory_alerts ?? "",
            slack_webhook_purchasing: map.slack_webhook_purchasing ?? "",
            slack_webhook_quality: map.slack_webhook_quality ?? "",
            slack_webhook_warehouse_ops: map.slack_webhook_warehouse_ops ?? "",
            slack_webhook_system_errors: map.slack_webhook_system_errors ?? "",
          }}
          locationOptions={locations}
          erpixApiKeyMasked={erpixMasked}
        />

        <DefectReasonsSectionClient>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Fault Type</th>
                  <th className="px-4 py-3">ERPIX ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {defectReasons.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      No active defect reasons found.
                    </td>
                  </tr>
                ) : (
                  defectReasons.map((reason) => (
                    <tr key={reason.id}>
                      <td className="px-4 py-3">{reason.name}</td>
                      <td className="px-4 py-3">{reason.faultType}</td>
                      <td className="px-4 py-3">{reason.erpixReasonId ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DefectReasonsSectionClient>
      </div>
    </div>
  );
}
