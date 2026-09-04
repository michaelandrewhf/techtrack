import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppLayout } from "./layout/AppLayout";
import { CatalogPage } from "./pages/CatalogPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EquipmentDetailPage } from "./pages/EquipmentDetailPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { LoginPage } from "./pages/LoginPage";
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
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { path: "/", element: <DashboardPage /> },
            { path: "/customers", element: <CustomersPage /> },
            { path: "/customers/:id", element: <CustomerDetailPage /> },
            { path: "/equipment", element: <EquipmentPage /> },
            { path: "/equipment/:id", element: <EquipmentDetailPage /> },
            { path: "/work-orders", element: <WorkOrdersPage /> },
            { path: "/work-orders/new", element: <WorkOrderCreatePage /> },
            { path: "/work-orders/:id", element: <WorkOrderDetailPage /> },
            { path: "/settings/:resource", element: <CatalogPage /> },
          ],
        },
      ],
    },
  ]);
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={createRouter()} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
