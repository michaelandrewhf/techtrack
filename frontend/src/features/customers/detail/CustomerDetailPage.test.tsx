import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerDetailPage } from "./CustomerDetailPage";

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
      <MemoryRouter initialEntries={["/customers/c1"]}>
        <Routes>
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CustomerDetailPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads heavy resource lists only when their tab is opened", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/customers/c1/")) {
        return json({
          id: "c1",
          name: "Cliente A",
          phone: "",
          whatsapp: "",
          email: "",
          notes: "",
          status: "active",
          customer_since: "2026-01-01",
          equipment_count: 2,
          active_work_order_count: 1,
          latest_work_order_at: "2026-09-01T10:00:00Z",
        });
      }
      return json(emptyPage);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Cliente A" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/v1/work-orders/?customer=c1"),
        ),
      ).toBe(true);
    });

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/v1/equipment/?customer=c1"),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole("tab", { name: /Equipamentos/ }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/v1/equipment/?customer=c1"),
        ),
      ).toBe(true);
    });
  });
});
