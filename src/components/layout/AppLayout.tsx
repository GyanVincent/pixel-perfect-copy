import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { MobileHeader } from "./MobileHeader";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col md:ml-64 overflow-x-hidden">
        <MobileHeader />
        <main className="flex-1 min-w-0 px-4 py-5 pb-24 md:p-8 md:pb-8 overflow-x-hidden">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
