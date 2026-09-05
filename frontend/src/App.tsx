import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { PageLoader } from "./components/State";
import { AppLayout } from "./layout/AppLayout";

const BusinessProfilePage = lazy(() =>
  import("./pages/BusinessProfilePage").then((module) => ({
    default: module.BusinessProfilePage,
  })),
);
const CatalogPage = lazy(() =>
  import("./pages/CatalogPage").then((module) => ({
    default: module.CatalogPage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import("./pages/CustomerDetailPage").then((module) => ({
    default: module.CustomerDetailPage,
  })),
);
const CustomersPage = lazy(() =>
  import("./pages/CustomersPage").then((module) => ({
    default: module.CustomersPage,
  })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const EquipmentDetailPage = lazy(() =>
  import("./pages/EquipmentDetailPage").then((module) => ({
    default: module.EquipmentDetailPage,
  })),
);
const EquipmentPage = lazy(() =>
  import("./pages/EquipmentPage").then((module) => ({
    default: module.EquipmentPage,
  })),
);
const FinancePage = lazy(() =>
  import("./pages/FinancePage").then((module) => ({
    default: module.FinancePage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
const QuoteCreatePage = lazy(() =>
  import("./pages/QuoteCreatePage").then((module) => ({
    default: module.QuoteCreatePage,
  })),
);
const QuoteDetailPage = lazy(() =>
  import("./pages/QuoteDetailPage").then((module) => ({
    default: module.QuoteDetailPage,
  })),
);
const QuotesPage = lazy(() =>
  import("./pages/QuotesPage").then((module) => ({
    default: module.QuotesPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("./pages/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const WorkOrderCreatePage = lazy(() =>
  import("./pages/WorkOrderCreatePage").then((module) => ({
    default: module.WorkOrderCreatePage,
  })),
);
const WorkOrderDetailPage = lazy(() =>
  import("./pages/WorkOrderDetailPage").then((module) => ({
    default: module.WorkOrderDetailPage,
  })),
);
const WorkOrdersPage = lazy(() =>
  import("./pages/WorkOrdersPage").then((module) => ({
    default: module.WorkOrdersPage,
  })),
);

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
    { path: "*", element: <NotFoundPage /> },
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
        <Suspense fallback={<PageLoader label="Carregando pagina" />}>
          <RouterProvider router={createRouter()} />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}
