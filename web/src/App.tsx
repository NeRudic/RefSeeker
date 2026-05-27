import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Collections } from "./pages/Collections";
import { CollectionDetail } from "./pages/CollectionDetail";
import { Session } from "./pages/Session";
import { Dashboard } from "./pages/admin/Dashboard";
import { Users } from "./pages/admin/Users";
import { NotFound } from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

function GuestRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-accent-400 animate-spin" />
      </div>
    );
  }
  if (authenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { authenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-accent-400 animate-spin" />
      </div>
    );
  }
  if (!authenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="collections" element={<Collections />} />
            <Route path="collections/:name" element={<CollectionDetail />} />
            <Route path="session/:id" element={<Session />} />
            <Route path="admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="admin/users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
