import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { useEffect } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppLayout } from "./layout/AppLayout";

type RouteModule = object;

function lazyPage<TModule extends RouteModule>(
  loader: () => Promise<TModule>,
  exportName: keyof TModule,
) {
  return async () => {
    const module = await loader();
    return { Component: module[exportName] as ComponentType };
  };
}

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
    {
      path: "/login",
      lazy: lazyPage(() => import("./pages/LoginPage"), "LoginPage"),
    },
    {
      path: "/forgot-password",
      lazy: lazyPage(
        () => import("./pages/ForgotPasswordPage"),
        "ForgotPasswordPage",
      ),
    },
    {
      path: "/reset-password/:uid/:token",
      lazy: lazyPage(
        () => import("./pages/ResetPasswordPage"),
        "ResetPasswordPage",
      ),
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            {
              path: "/",
              lazy: lazyPage(
                () => import("./pages/DashboardPage"),
                "DashboardPage",
              ),
            },
            {
              path: "/profile",
              lazy: lazyPage(
                () => import("./pages/ProfilePage"),
                "ProfilePage",
              ),
            },
            {
              path: "/customers",
              lazy: lazyPage(
                () => import("./pages/CustomersPage"),
                "CustomersPage",
              ),
            },
            {
              path: "/customers/:id",
              lazy: lazyPage(
                () => import("./features/customers/detail/CustomerDetailPage"),
                "CustomerDetailPage",
              ),
            },
            {
              path: "/equipment",
              lazy: lazyPage(
                () => import("./pages/EquipmentPage"),
                "EquipmentPage",
              ),
            },
            {
              path: "/equipment/:id",
              lazy: lazyPage(
                () => import("./features/equipment/detail/EquipmentDetailPage"),
                "EquipmentDetailPage",
              ),
            },
            {
              path: "/work-orders",
              lazy: lazyPage(
                () => import("./pages/WorkOrdersPage"),
                "WorkOrdersPage",
              ),
            },
            {
              path: "/work-orders/new",
              lazy: lazyPage(
                () => import("./pages/WorkOrderCreatePage"),
                "WorkOrderCreatePage",
              ),
            },
            {
              path: "/work-orders/:id",
              lazy: lazyPage(
                () =>
                  import("./features/workorders/detail/WorkOrderDetailPage"),
                "WorkOrderDetailPage",
              ),
            },
            {
              path: "/quotes",
              lazy: lazyPage(() => import("./pages/QuotesPage"), "QuotesPage"),
            },
            {
              path: "/quotes/new",
              lazy: lazyPage(
                () => import("./pages/QuoteCreatePage"),
                "QuoteCreatePage",
              ),
            },
            {
              path: "/quotes/:id",
              lazy: lazyPage(
                () => import("./features/quotes/detail/QuoteDetailPage"),
                "QuoteDetailPage",
              ),
            },
            {
              path: "/finance",
              lazy: lazyPage(
                () => import("./features/finance/FinancePage"),
                "FinancePage",
              ),
            },
            {
              path: "/settings",
              lazy: lazyPage(
                () => import("./pages/SettingsPage"),
                "SettingsPage",
              ),
            },
            {
              path: "/settings/business-profile",
              lazy: lazyPage(
                () => import("./pages/BusinessProfilePage"),
                "BusinessProfilePage",
              ),
            },
            {
              path: "/settings/:resource",
              lazy: lazyPage(
                () => import("./pages/CatalogPage"),
                "CatalogPage",
              ),
            },
            {
              path: "*",
              lazy: lazyPage(
                () => import("./pages/NotFoundPage"),
                "NotFoundPage",
              ),
            },
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
