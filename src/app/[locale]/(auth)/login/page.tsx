"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleLogin = async (role: string) => {
    setLoading(role);
    await signIn("credentials", { role, callbackUrl: "/" });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      <div className="p-8 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl max-w-sm w-full border border-white/50">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ArtPix 3D</h1>
          <p className="text-sm text-slate-500 mt-1">Inventory Management System</p>
          <p className="text-xs text-slate-400 mt-0.5">Development Mock Login</p>
        </div>
        
        <div className="space-y-3">
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('admin')}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            {loading === 'admin' ? "Signing in..." : "Login as Admin"}
          </button>
          
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('manager')}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            <span className="w-2 h-2 rounded-full bg-blue-300" />
            {loading === 'manager' ? "Signing in..." : "Login as Manager"}
          </button>
          
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('purchaser')}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            <span className="w-2 h-2 rounded-full bg-amber-300" />
            {loading === 'purchaser' ? "Signing in..." : "Login as Purchaser"}
          </button>
          
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('warehouse')}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
            {loading === 'warehouse' ? "Signing in..." : "Login as Warehouse"}
          </button>
        </div>
      </div>
    </div>
  );
}
