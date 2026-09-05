import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkOrderDetailPage } from "./WorkOrderDetailPage";

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const emptyPage = { count: 0, next: null, previous: null, results: [] };

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/work-orders/os1"]}>
        <Routes>
          <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkOrderDetailPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not load the status catalog for a closed work order", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/work-orders/os1/")) {
        return json({
          id: "os1",
          number: 1,
          display_number: "OS-000001",
          customer: {
            id: "c1",
            name: "Cliente A",
            phone: "",
            whatsapp: "",
            email: "",
            status: "active",
          },
          equipment: {
            id: "e1",
            customer: {
              id: "c1",
              name: "Cliente A",
              phone: "",
              whatsapp: "",
              email: "",
              status: "active",
            },
            equipment_type: {
              id: "et1",
              name: "Notebook",
              is_active: true,
            },
            manufacturer: "Dell",
            model: "Latitude",
            serial_number: "",
            asset_tag: "",
            status: "active",
          },
          status: {
            id: "st1",
            name: "Concluida",
            code: "done",
            kind: "completed",
            is_active: true,
          },
          priority: "normal",
          responsible_user: null,
          title: "Manutencao",
          problem_description: "Teste",
          diagnosis: "",
          service_description: "",
          solution: "",
          internal_notes: "",
          opened_at: "2026-09-04T12:00:00Z",
          completed_at: "2026-09-04T13:00:00Z",
          cancelled_at: null,
          status_history: [],
          services: [],
          parts: [],
          billing: null,
        });
      }
      if (url.includes("/api/v1/receivables/")) return json(emptyPage);
      return json(emptyPage);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "OS-000001" }),
    ).toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/v1/work-order-statuses/"),
      ),
    ).toBe(false);
  });
});
