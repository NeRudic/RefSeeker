import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/shared/ui/button";
import { Search, SlidersHorizontal, Loader2, Plus, X, AlertTriangle } from "lucide-react";
import { createSession, ApiError } from "@/shared/api/client";
import { useAuth } from "@/app/auth-context";
import { cn } from "@/shared/lib/cn";
import { Link } from "react-router-dom";

const SUGGESTIONS = ["Tu-160", "F-35 cockpit", "T-90M", "brutalist architecture", "vintage typewriter"];

export function SearchForm() {
  const navigate = useNavigate();
  const { isAuthenticated, rateLimit, refreshUser } = useAuth();
  const [query, setQuery] = useState("");
  const [maxImages, setMaxImages] = useState(50);
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistInput, setBlacklistInput] = useState("");
  const [focused, setFocused] = useState(false);

  const recentQueries: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("recent_searches") || "[]");
    } catch {
      return [];
    }
  })();

  const addBlacklistItem = () => {
    const trimmed = blacklistInput.trim().toLowerCase();
    if (!trimmed || blacklist.includes(trimmed)) return;
    setBlacklist((prev) => [...prev, trimmed]);
    setBlacklistInput("");
  };

  const removeBlacklistItem = (idx: number) => {
    setBlacklist((prev) => prev.filter((_, i) => i !== idx));
  };

  const remaining = rateLimit?.remaining ?? 1;
  const isDisabled = !query.trim() || loading || remaining <= 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || remaining <= 0) return;

    setLoading(true);
    setError("");
    setRateLimited(false);

    try {
      const { session_id } = await createSession(trimmed, maxImages, blacklist);

      const recent = [trimmed, ...recentQueries.filter((q) => q !== trimmed)].slice(0, 5);
      localStorage.setItem("recent_searches", JSON.stringify(recent));

      refreshUser();
      navigate(`/search/${session_id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setRateLimited(true);
        refreshUser();
      } else {
        setError(err instanceof Error ? err.message : "Failed to start search");
      }
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      {/* Search input */}
      <div className="relative">
        <div
          className={cn(
            "relative rounded-2xl transition-all duration-300",
            focused && "accent-glow"
          )}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent-500/20 via-accent-blue/10 to-transparent pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Describe what you're looking for..."
            className={cn(
              "relative w-full h-14 pl-12 pr-4 rounded-2xl bg-surface-2 border text-text-primary text-base",
              "placeholder:text-text-muted",
              "transition-all duration-200",
              focused
                ? "border-accent-500/40 bg-surface-3"
                : "border-border hover:border-border-hover",
            )}
            disabled={loading}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
        </div>
      </div>

      {/* Actions row */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors rounded-lg px-2.5 py-1.5",
            showOptions
              ? "bg-accent-500/10 text-accent-400"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Options{blacklist.length > 0 ? ` (${blacklist.length})` : ""}
        </button>

        <Button type="submit" size="lg" disabled={isDisabled}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
          ) : (
            <><Search className="h-4 w-4" /> Search</>
          )}
        </Button>
      </div>

      {/* Options panel */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {/* Max images */}
              <div className="glass rounded-xl p-4">
                <label className="block text-xs text-text-secondary mb-2">
                  Max images to collect
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={10}
                    value={maxImages}
                    onChange={(e) => setMaxImages(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-accent-500 cursor-pointer"
                  />
                  <span className="text-sm font-mono text-text-primary min-w-[3ch] tabular-nums">
                    {maxImages}
                  </span>
                </div>
              </div>

              {/* Blacklist */}
              <div className="glass rounded-xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <label className="text-xs font-medium text-text-primary">
                      Content Blacklist{" "}
                      <span className="text-text-muted font-normal">(optional)</span>
                    </label>
                    <p className="text-xs text-text-muted mt-0.5">
                      Images matching these terms will be rejected during AI verification
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={blacklistInput}
                    onChange={(e) => setBlacklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBlacklistItem();
                      }
                    }}
                    placeholder="e.g. cartoon, text overlay..."
                    className="flex-1 h-10 px-3 rounded-xl bg-white/[0.04] border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-500/40 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={addBlacklistItem}
                    disabled={!blacklistInput.trim()}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-medium text-text-secondary bg-white/[0.04] border border-border hover:text-text-primary hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
                {blacklist.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {blacklist.map((item, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/8 border border-amber-500/15 px-2 py-1 text-xs text-amber-400"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeBlacklistItem(i)}
                          className="hover:text-amber-300 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rate limited message */}
      {rateLimited && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 glass rounded-xl p-4 border border-amber-500/15"
        >
          {isAuthenticated ? (
            <p className="text-sm text-amber-400">
              Daily search limit reached. Try again tomorrow or upgrade your plan.
            </p>
          ) : (
            <p className="text-sm text-amber-400">
              You've used your free search.{" "}
              <Link to="/register" className="text-accent-400 hover:text-accent-300 font-medium">
                Create an account
              </Link>{" "}
              or{" "}
              <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium">
                sign in
              </Link>{" "}
              to continue.
            </p>
          )}
        </motion.div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {/* Suggestions / recent */}
      {!loading && !query && (
        <div className="mt-8">
          {recentQueries.length > 0 ? (
            <>
              <p className="text-xs text-text-muted mb-2">Recent searches</p>
              <div className="flex flex-wrap gap-2">
                {recentQueries.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuery(q)}
                    className="glass rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary glass-hover transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-text-muted mb-2 text-center">Try searching for</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuery(s)}
                    className="glass rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary glass-hover transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </form>
  );
}
