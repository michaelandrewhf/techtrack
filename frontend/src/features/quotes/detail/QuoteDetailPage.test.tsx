import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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

function quote(status = "draft") {
  return {
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
    status,
    valid_until: null,
    discount: "0.00",
    notes: "",
    sent_at: status === "sent" ? "2026-09-04T12:05:00Z" : null,
    approved_at: status === "approved" ? "2026-09-04T12:10:00Z" : null,
    items_total: "100.00",
    total_amount: "100.00",
    items: [
      {
        id: "i1",
        item_type: "service",
        service_type: "s1",
        service_type_name: "Configuracao",
        part: null,
        part_name: null,
        description: "Configuracao de rede",
        quantity: "1.00",
        unit_price: "100.00",
        discount: "0.00",
        total: "100.00",
        sort_order: 0,
      },
    ],
    documents: [],
    created_at: "2026-09-04T12:00:00Z",
    updated_at: "2026-09-04T12:00:00Z",
  };
}

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
        return json(quote());
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

  it("opens confirmation and approves a quote after it is sent", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/v1/quotes/q1/approve/") && init?.method === "POST") {
          return json(quote("approved"));
        }
        if (url.endsWith("/api/v1/quotes/q1/")) {
          return json(quote("sent"));
        }
        return json(emptyPage);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await screen.findByRole("heading", { name: "ORC-000001" });

    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Aprovar orcamento",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Aprovar" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/quotes/q1/approve/",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
