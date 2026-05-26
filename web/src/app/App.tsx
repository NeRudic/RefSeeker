import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/app/auth-context";
import { Sidebar } from "@/widgets/sidebar/sidebar";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { GalleryPage } from "@/pages/GalleryPage";
import { CollectionPage } from "@/pages/CollectionPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AdminPage } from "@/pages/AdminPage";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 2,
    },
  },
});

function ProtectedRoute({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && user?.role !== "admin") return <Navigate to="/" replace />;

  return <>{children}</>;
}

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-base-900">
      <Sidebar />
      <main className="flex-1 ml-16">
        {children}
      </main>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/search/:sessionId" element={<SearchPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/gallery/:name" element={<CollectionPage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
