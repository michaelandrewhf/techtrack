import { Navigate, Outlet, useLocation } from "react-router-dom";

import { PageLoader } from "../components/State";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) return <PageLoader label="Verificando sessao" />;
  if (!auth.isAuthenticated)
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
