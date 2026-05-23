import { SearchForm } from "@/widgets/search-form/search-form";
import { RateLimitBanner } from "@/widgets/rate-limit-banner/rate-limit-banner";
import { Hexagon } from "lucide-react";

export function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      <RateLimitBanner />

      {/* Hero */}
      <div className="relative z-10 w-full max-w-3xl text-center mb-12 animate-slide-up">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500/10 ring-1 ring-accent-500/20">
          <Hexagon className="h-8 w-8 text-accent-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-100 mb-4">
          Find perfect
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-accent-300">
            {" "}reference images
          </span>
        </h1>
        <p className="text-lg text-neutral-500 max-w-xl mx-auto leading-relaxed">
          Describe what you need, and RefSeeker will search, download, and
          automatically verify images using AI to find the best references.
        </p>
      </div>

      {/* Search */}
      <div className="relative z-10 w-full animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <SearchForm />
      </div>

      {/* Features */}
      <div className="relative z-10 mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full animate-fade-in">
        {[
          {
            title: "Smart Search",
            desc: "Multi-variant queries for broad coverage",
          },
          {
            title: "AI Verification",
            desc: "Gemini 2.5 Flash checks relevance & quality",
          },
          {
            title: "Auto Curation",
            desc: "Filters watermarks, low-res, unwanted content",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="glass rounded-xl p-4 text-center"
          >
            <p className="text-sm font-medium text-neutral-200">{f.title}</p>
            <p className="text-xs text-neutral-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
