import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
