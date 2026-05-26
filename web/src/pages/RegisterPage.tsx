import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/auth-context";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Hexagon, Loader2, UserPlus, ArrowRight } from "lucide-react";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await register({ email: email.trim(), password });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <div className="text-center mb-8">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient shadow-lg shadow-accent-500/25">
            <Hexagon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
          <p className="text-sm text-text-secondary mt-1">Start collecting reference images</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          <Input
            id="confirm"
            label="Confirm password"
            type="password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={!email.trim() || !password || !confirm || loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>
            ) : (
              <><UserPlus className="h-4 w-4" /> Create account</>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-accent-400 hover:text-accent-300 transition-colors font-medium">
            Sign in <ArrowRight className="inline h-3 w-3" />
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
