import { Link } from "@tanstack/react-router";
import { GraduationCap, LogOut, BarChart3, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function MobileHeader() {
  const { logout } = useAuth();
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur px-4 py-3 md:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
          <GraduationCap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-display text-lg font-bold gradient-text">SmartPrep</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link to="/groups" aria-label="Study Groups" className="p-2 rounded-lg text-muted-foreground hover:bg-muted">
          <Users className="h-5 w-5" />
        </Link>
        <Link to="/analytics" aria-label="Analytics" className="p-2 rounded-lg text-muted-foreground hover:bg-muted">
          <BarChart3 className="h-5 w-5" />
        </Link>
        <button
          onClick={() => logout()}
          aria-label="Sign out"
          className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
