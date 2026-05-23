import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/auth-context";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Hexagon, Loader2, LogIn } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason");
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    try {
      await login({ email: email.trim(), password });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/10 ring-1 ring-accent-500/20">
            <Hexagon className="h-6 w-6 text-accent-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-100">Welcome back</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in to your RefSeeker account</p>
        </div>

        {reason === "rate_limited" && (
          <div className="mb-4 glass rounded-xl p-3 border border-amber-500/20">
            <p className="text-xs text-amber-400 text-center">
              You've used your free search. Sign in for more.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            error={error ? " " : undefined}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={!email.trim() || !password || loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
            ) : (
              <><LogIn className="h-4 w-4" /> Sign in</>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-accent-400 hover:text-accent-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
