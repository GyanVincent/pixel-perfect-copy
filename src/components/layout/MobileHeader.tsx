import { Link, useLocation } from "@tanstack/react-router";
import {
  GraduationCap,
  LogOut,
  Menu,
  LayoutDashboard,
  BookOpen,
  Play,
  Calendar,
  Users,
  Sparkles,
  BarChart3,
  TrendingUp,
  User,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUnreadGroups } from "@/hooks/use-unread-groups";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: Play },
  { to: "/daily-challenge", label: "Daily Challenge", icon: Calendar },
  { to: "/groups", label: "Study Groups", icon: Users },
  { to: "/tutor", label: "AI Tutor", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/challenge-analytics", label: "Challenge Stats", icon: TrendingUp },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function MobileHeader() {
  const { logout, user } = useAuth();
  const unread = useUnreadGroups();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur px-3 py-3 md:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex items-center gap-1 min-w-0">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open menu"
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw] p-0 flex flex-col">
            <SheetHeader className="px-5 py-4 border-b border-border">
              <SheetTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                  <GraduationCap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-display text-lg font-bold gradient-text">SmartPrep</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const isActive =
                  location.pathname === to || location.pathname.startsWith(to + "/");
                const showBadge = to === "/groups" && unread > 0;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span className="flex-1">{label}</span>
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border p-4">
              <div className="mb-3 px-2 text-xs text-muted-foreground truncate">
                {user?.email}
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4.5 w-4.5" />
                Sign Out
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shrink-0">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold gradient-text truncate">SmartPrep</span>
        </Link>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          to="/groups"
          aria-label="Study Groups"
          className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted"
        >
          <Users className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <Link
          to="/analytics"
          aria-label="Analytics"
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
        >
          <BarChart3 className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
