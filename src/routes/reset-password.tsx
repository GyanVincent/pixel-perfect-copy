import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate({ to: "/login" }), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary mb-4">
          <GraduationCap className="h-6 w-6 text-primary-foreground" />
        </div>
        {done ? (
          <>
            <h1 className="font-display text-2xl font-bold">Password updated!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting to sign in...</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Set new password</h1>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
              {error && (
                <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
              )}
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                placeholder="New password"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl gradient-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
            <Link to="/login" className="mt-4 inline-block text-sm text-muted-foreground hover:underline">
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
