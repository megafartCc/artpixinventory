import { AppShell } from "@/components/AppShell";

export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return <AppShell locale={params.locale}>{children}</AppShell>;
}
