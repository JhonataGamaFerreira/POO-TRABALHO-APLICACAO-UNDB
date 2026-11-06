import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <div className="flex flex-col md:flex-row">
        <SidebarNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
