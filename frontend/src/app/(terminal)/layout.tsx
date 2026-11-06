import { AppShell } from "@/components/layout/app-shell";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
