import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/auth-context";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Hexagon, Loader2, LogIn, ArrowRight } from "lucide-react";

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
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient shadow-lg shadow-accent-500/25">
            <Hexagon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome back</h1>
          <p className="text-sm text-text-secondary mt-1">Sign in to your account</p>
        </div>

        {reason === "rate_limited" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 glass rounded-xl p-3 border border-amber-500/15"
          >
            <p className="text-xs text-amber-400 text-center">
              You've used your free search. Sign in for more.
            </p>
          </motion.div>
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
            placeholder="Enter your password"
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

        <p className="text-center text-sm text-text-secondary mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-accent-400 hover:text-accent-300 transition-colors font-medium">
            Create one <ArrowRight className="inline h-3 w-3" />
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
