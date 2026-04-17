"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuthLogin = async () => {
    setLoading('google');
    await signIn("google", { callbackUrl: "/" });
  };

  const handleMockLogin = async (role: string) => {
    setLoading(role);
    await signIn("credentials", { role, callbackUrl: "/" });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4">
      <div className="p-8 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl max-w-sm w-full border border-white/50">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ArtPix 3D</h1>
          <p className="text-sm text-slate-500 mt-1">Inventory Management System</p>
        </div>
        
        <div className="space-y-4">
          <button 
            disabled={!!loading}
            onClick={handleOAuthLogin}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm hover:shadow-md border border-slate-200"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading === 'google' ? "Signing in..." : "Continue with Google"}
          </button>

          <div className="relative py-3 flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400">DEVELOPER FALLBACKS</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>
          
          <button 
            disabled={!!loading}
            onClick={() => handleMockLogin('admin')}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Mock Admin
          </button>
          
          <button 
            disabled={!!loading}
            onClick={() => handleMockLogin('manager')}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Mock Manager
          </button>
        </div>
      </div>
    </div>
  );
}
