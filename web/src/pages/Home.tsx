import { SearchBar } from "../components/SearchBar";

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Background glow */}
      <div className="absolute inset-0 bg-mesh-pattern pointer-events-none" style={{ top: "-10%" }} />

      <div className="relative z-10 text-center w-full max-w-2xl animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse-soft" />
          AI-powered reference image search
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Find perfect{" "}
          <span className="text-gradient">reference images</span>
        </h1>
        <p className="text-lg text-zinc-400 mb-10">
          Search, verify, and collect high-quality reference images powered by multiple vision AI models working in parallel.
        </p>

        <SearchBar />

        <div className="mt-12 grid grid-cols-3 gap-6 text-center">
          {[
            { value: "4×", label: "Vision models verify in parallel" },
            { value: "<1min", label: "First results streamed live" },
            { value: "100%", label: "AI-filtered for quality & relevance" },
          ].map(({ value, label }) => (
            <div key={label} className="glass-card p-4">
              <div className="text-xl font-bold text-gradient mb-1">{value}</div>
              <div className="text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
