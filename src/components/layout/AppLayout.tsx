import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { MobileHeader } from "./MobileHeader";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col md:ml-64">
        <MobileHeader />
        <main className="flex-1 px-4 py-5 pb-24 md:p-8 md:pb-8">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
