import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
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
        {sent ? (
          <>
            <h1 className="font-display text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a reset link to <strong>{email}</strong>.
            </p>
            <Link to="/login" className="mt-6 inline-block text-sm text-accent hover:underline">
              Back to Sign In
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Reset password</h1>
            <p className="mt-1 text-sm text-muted-foreground mb-6">Enter your email to receive a reset link</p>
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {error && (
                <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                placeholder="you@university.edu"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl gradient-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
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
