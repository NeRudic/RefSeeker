import { Link } from "react-router-dom";
import { Search } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-7xl font-bold text-gradient mb-4">404</div>
      <h1 className="text-xl font-semibold text-zinc-200 mb-2">Page not found</h1>
      <p className="text-zinc-500 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="accent-button flex items-center gap-2">
        <Search size={18} />
        Back to Search
      </Link>
    </div>
  );
}
