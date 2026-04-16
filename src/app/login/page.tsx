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
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="p-8 bg-white shadow-lg rounded-xl max-w-sm w-full border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ArtPix 3D</h1>
          <p className="text-sm text-slate-500 mt-1">Mock Login for Development</p>
        </div>
        
        <div className="space-y-3">
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('admin')}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors flex justify-center disabled:opacity-50"
          >
            {loading === 'admin' ? "Signing in..." : "Login as Admin"}
          </button>
          
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('manager')}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex justify-center disabled:opacity-50"
          >
            {loading === 'manager' ? "Signing in..." : "Login as Manager"}
          </button>
          
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('purchaser')}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors flex justify-center disabled:opacity-50"
          >
            {loading === 'purchaser' ? "Signing in..." : "Login as Purchaser"}
          </button>
          
          <button 
            disabled={!!loading}
            onClick={() => handleLogin('warehouse')}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex justify-center disabled:opacity-50"
          >
            {loading === 'warehouse' ? "Signing in..." : "Login as Warehouse"}
          </button>
        </div>
      </div>
    </div>
  );
}
