import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { CustomerDetailPage } from "./features/customers/detail/CustomerDetailPage";
import { AppLayout } from "./layout/AppLayout";
import { BusinessProfilePage } from "./pages/BusinessProfilePage";
import { CatalogPage } from "./pages/CatalogPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EquipmentDetailPage } from "./pages/EquipmentDetailPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { FinancePage } from "./pages/FinancePage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { QuoteCreatePage } from "./pages/QuoteCreatePage";
import { QuoteDetailPage } from "./pages/QuoteDetailPage";
import { QuotesPage } from "./pages/QuotesPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WorkOrderCreatePage } from "./pages/WorkOrderCreatePage";
import { WorkOrderDetailPage } from "./pages/WorkOrderDetailPage";
import { WorkOrdersPage } from "./pages/WorkOrdersPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function createRouter() {
  return createBrowserRouter([
    { path: "/login", element: <LoginPage /> },
    { path: "/forgot-password", element: <ForgotPasswordPage /> },
    {
      path: "/reset-password/:uid/:token",
      element: <ResetPasswordPage />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { path: "/", element: <DashboardPage /> },
            { path: "/profile", element: <ProfilePage /> },
            { path: "/customers", element: <CustomersPage /> },
            { path: "/customers/:id", element: <CustomerDetailPage /> },
            { path: "/equipment", element: <EquipmentPage /> },
            { path: "/equipment/:id", element: <EquipmentDetailPage /> },
            { path: "/work-orders", element: <WorkOrdersPage /> },
            { path: "/work-orders/new", element: <WorkOrderCreatePage /> },
            { path: "/work-orders/:id", element: <WorkOrderDetailPage /> },
            { path: "/quotes", element: <QuotesPage /> },
            { path: "/quotes/new", element: <QuoteCreatePage /> },
            { path: "/quotes/:id", element: <QuoteDetailPage /> },
            { path: "/finance", element: <FinancePage /> },
            { path: "/settings", element: <SettingsPage /> },
            {
              path: "/settings/business-profile",
              element: <BusinessProfilePage />,
            },
            { path: "/settings/:resource", element: <CatalogPage /> },
          ],
        },
      ],
    },
  ]);
}

export function App() {
  useEffect(() => {
    const dark = localStorage.getItem("techtrack.theme") === "dark";
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={createRouter()} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
