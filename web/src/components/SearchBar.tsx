import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { apiPost } from "../api/client";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiPost<{ session_id: string }>("/sessions", {
        query: q,
        max_images: 50,
      });
      navigate(`/session/${data.session_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reference images..."
          className="accent-input !py-2 text-sm flex-1"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !query.trim()} className="accent-button !px-4 !py-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
        {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
      </form>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto animate-slide-up">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <div className="absolute inset-0 bg-accent-gradient rounded-2xl blur-2xl opacity-20" />
          <div className="relative glass-card p-1.5 flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you looking for? e.g. Tu-160 walkaround..."
              className="flex-1 bg-transparent border-none px-5 py-4 text-zinc-200 placeholder-zinc-500 text-lg outline-none"
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="accent-button !rounded-xl flex items-center gap-2 text-base !px-8 !py-4"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Search size={20} />
              )}
              Search
            </button>
          </div>
        </div>
      </form>
      {error && (
        <p className="text-red-400 text-sm mt-3 text-center bg-red-500/10 border border-red-500/25 rounded-lg py-2">
          {error}
        </p>
      )}
    </div>
  );
}
