import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinancePage } from "./FinancePage";

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
      <MemoryRouter initialEntries={["/finance"]}>
        <Routes>
          <Route path="/finance" element={<FinancePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FinancePage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads finance lists only when their tab or searchable action is used", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/finance/dashboard/")) {
        return json({
          pending_total: "100.00",
          overdue_total: "0.00",
          received_this_month: "250.00",
          upcoming: [],
          recent_payments: [],
        });
      }
      return json(emptyPage);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Financeiro" }),
    ).toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/v1/receivables/"),
      ),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/v1/payments/"),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole("tab", { name: /Recebimentos/ }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/v1/payments/"),
        ),
      ).toBe(true);
    });

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/v1/receivables/"),
      ),
    ).toBe(false);

    await userEvent.click(
      screen.getByRole("button", { name: "Registrar pagamento" }),
    );
    const receivableSearch = screen.getByRole("combobox", {
      name: "Conta a receber",
    });
    await userEvent.type(receivableSearch, "Cliente A");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(String(input), "http://localhost");
          return (
            url.pathname.endsWith("/api/v1/receivables/") &&
            url.searchParams.get("open") === "true" &&
            url.searchParams.get("search") === "Cliente A" &&
            url.searchParams.get("page_size") === "10"
          );
        }),
      ).toBe(true);
    });
  });

  it("uses the server open filter for accounts receivable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/finance/dashboard/")) {
        return json({
          pending_total: "180.00",
          overdue_total: "0.00",
          received_this_month: "300.00",
          upcoming: [],
          recent_payments: [],
        });
      }
      if (url.includes("/api/v1/receivables/")) {
        return json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: "r-open",
              customer: "c2",
              customer_name: "Cliente B",
              description: "Mensalidade pendente",
              origin: "agreement",
              due_date: "2026-09-15",
              amount: "180.00",
              balance: "180.00",
              status: "pending",
              is_overdue: false,
            },
          ],
        });
      }
      return json(emptyPage);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Financeiro" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("tab", { name: /Contas a receber/ }),
    );

    expect(
      (await screen.findAllByText("Mensalidade pendente")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("tab", { name: /Contas a receber/ }),
    ).toHaveTextContent("1");
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = new URL(String(input), "http://localhost");
        return (
          url.pathname.endsWith("/api/v1/receivables/") &&
          url.searchParams.get("open") === "true" &&
          url.searchParams.get("page_size") === "25"
        );
      }),
    ).toBe(true);
  });
});
