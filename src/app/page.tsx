import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center pt-24">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">ArtPix 3D Dashboard</h1>
        <p className="text-slate-500 mb-8">Coming Soon in Session 3 & 21...</p>
        
        <div className="p-4 bg-slate-100 rounded-lg border border-slate-200 text-sm overflow-auto">
          <span className="font-semibold text-slate-700 block mb-2">Current Active Session:</span>
          <pre className="text-emerald-700 font-mono">
            {JSON.stringify(session?.user || {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
