import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuoteDetailPage } from "./QuoteDetailPage";

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
      <MemoryRouter initialEntries={["/quotes/q1"]}>
        <Routes>
          <Route path="/quotes/:id" element={<QuoteDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("QuoteDetailPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads item catalogs only after opening the item composer", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/quotes/q1/")) {
        return json({
          id: "q1",
          number: 1,
          display_number: "ORC-000001",
          customer: "c1",
          customer_name: "Cliente A",
          equipment: null,
          equipment_label: null,
          work_order: null,
          work_order_number: null,
          title: "Upgrade de memoria",
          description: "",
          status: "draft",
          valid_until: null,
          discount: "0.00",
          notes: "",
          sent_at: null,
          approved_at: null,
          items_total: "0.00",
          total_amount: "0.00",
          items: [],
          documents: [],
          created_at: "2026-09-04T12:00:00Z",
          updated_at: "2026-09-04T12:00:00Z",
        });
      }
      return json(emptyPage);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "ORC-000001" }),
    ).toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/v1/service-types/"),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /Novo item/ }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/v1/service-types/"),
        ),
      ).toBe(true);
    });
  });
});
