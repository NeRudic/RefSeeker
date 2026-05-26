import { SearchForm } from "@/widgets/search-form/search-form";
import { RateLimitBanner } from "@/widgets/rate-limit-banner/rate-limit-banner";
import { motion } from "framer-motion";
import { Hexagon, Zap, Shield, Sparkles } from "lucide-react";

const features = [
  { icon: Zap, label: "Smart Search", desc: "Multi-variant queries for broad coverage" },
  { icon: Shield, label: "AI Verification", desc: "Parallel vision models check every image" },
  { icon: Sparkles, label: "Auto Curation", desc: "Filters watermarks, low-res, and unwanted content" },
];

export function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      <RateLimitBanner />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-2xl text-center mb-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl accent-gradient shadow-lg shadow-accent-500/25"
        >
          <Hexagon className="h-8 w-8 text-white" />
        </motion.div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary mb-4">
          Find perfect
          <br />
          <span className="accent-gradient-text">reference images</span>
        </h1>
        <p className="text-base text-text-secondary max-w-lg mx-auto leading-relaxed">
          Describe what you need. RefSeeker searches, downloads, and verifies
          images using multiple AI models to find the best references.
        </p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative z-10 w-full"
      >
        <SearchForm />
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="relative z-10 mt-20 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl w-full"
      >
        {features.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="glass rounded-xl px-4 py-3 text-center group hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex justify-center mb-2">
              <div className="rounded-lg bg-accent-500/10 p-1.5">
                <Icon className="h-3.5 w-3.5 text-accent-400" />
              </div>
            </div>
            <p className="text-xs font-medium text-text-primary">{label}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{desc}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
