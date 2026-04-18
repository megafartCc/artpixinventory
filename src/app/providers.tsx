"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ duration: 3500, className: "shadow-lg" }}
      />
    </SessionProvider>
  );
}
