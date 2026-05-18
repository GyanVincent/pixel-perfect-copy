import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, Play, BarChart3, User, LogOut, GraduationCap, Sparkles, Users, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUnreadGroups } from "@/hooks/use-unread-groups";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: Play },
  { to: "/daily-challenge", label: "Daily Challenge", icon: Calendar },
  { to: "/groups", label: "Study Groups", icon: Users },
  { to: "/tutor", label: "AI Tutor", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { logout, user } = useAuth();
  const unreadGroups = useUnreadGroups();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 z-30 h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
          <GraduationCap className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-display text-xl font-bold gradient-text">SmartPrep</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to || location.pathname.startsWith(to + "/");
          const showBadge = to === "/groups" && unreadGroups > 0;
          return (
            <Link
              key={to}
              to={to}
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
                  {unreadGroups > 99 ? "99+" : unreadGroups}
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
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
