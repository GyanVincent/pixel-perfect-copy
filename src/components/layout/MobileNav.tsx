import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, Play, Sparkles, User } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: Play },
  { to: "/tutor", label: "Tutor", icon: Sparkles },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function MobileNav() {
  const location = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map(({ to, label, icon: Icon }) => {
        const isActive = location.pathname === to || location.pathname.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
              isActive ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
