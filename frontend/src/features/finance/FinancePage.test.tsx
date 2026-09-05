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

  it("loads finance lists only when their tab or action is opened", async () => {
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

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/v1/receivables/"),
        ),
      ).toBe(true);
    });
  });
});
