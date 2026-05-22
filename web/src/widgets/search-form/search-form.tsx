import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Search, SlidersHorizontal, Loader2, Plus, X, AlertTriangle } from "lucide-react";
import { createSession } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";

export function SearchForm() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [maxImages, setMaxImages] = useState(50);
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistInput, setBlacklistInput] = useState("");

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      const { session_id } = await createSession(trimmed, maxImages, blacklist);

      // Save to recent
      const recent = [trimmed, ...recentQueries.filter((q) => q !== trimmed)].slice(
        0, 5
      );
      localStorage.setItem("recent_searches", JSON.stringify(recent));

      navigate(`/search/${session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start search");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g., "vintage typewriter", "brutalist architecture"...'
          className="h-14 pl-12 pr-4 text-base rounded-2xl border-white/10 bg-white/5"
          disabled={loading}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className={cn(
            "flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors",
            showOptions && "text-accent-400"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Options{blacklist.length > 0 ? ` (${blacklist.length} blacklisted)` : ""}
        </button>

        <Button type="submit" size="lg" disabled={!query.trim() || loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Search References
            </>
          )}
        </Button>
      </div>

      {showOptions && (
        <div className="mt-3 animate-fade-in space-y-3">
          {/* Max images */}
          <div className="glass rounded-xl p-4">
            <label className="block text-xs text-neutral-500 mb-2">
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
              <span className="text-sm font-mono text-neutral-300 min-w-[3ch] tabular-nums">
                {maxImages === 0 ? "∞" : maxImages}
              </span>
            </div>
          </div>

          {/* Blacklist */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Content Blacklist{" "}
                  <span className="text-neutral-600 font-normal">(optional)</span>
                </label>
                <p className="text-xs text-neutral-600 mt-0.5">
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
                className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-accent-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={addBlacklistItem}
                disabled={!blacklistInput.trim()}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-medium text-neutral-400 bg-white/5 border border-white/10 hover:text-neutral-200 hover:bg-white/10 transition-colors disabled:opacity-40"
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
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-xs text-amber-400"
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
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400 animate-fade-in">{error}</p>
      )}

      {!loading && recentQueries.length > 0 && !query && (
        <div className="mt-6 animate-fade-in">
          <p className="text-xs text-neutral-600 mb-2">Recent searches</p>
          <div className="flex flex-wrap gap-2">
            {recentQueries.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuery(q)}
                className="glass rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 glass-hover transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
