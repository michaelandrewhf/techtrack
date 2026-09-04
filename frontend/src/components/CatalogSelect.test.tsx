import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CatalogSelect } from "./CatalogSelect";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("CatalogSelect", () => {
  it("creates a catalog option inline and selects it", async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.includes("/api/v1/equipment-types/") &&
          init?.method === "POST"
        ) {
          return json({
            id: "new-type",
            name: "NVR",
            slug: "nvr",
            is_active: true,
          });
        }
        return json({ count: 0, next: null, previous: null, results: [] });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(
      <CatalogSelect
        label="Tipo"
        resource="equipment-types"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Novo" }));
    await userEvent.type(
      screen.getByPlaceholderText("Nome do novo item"),
      "NVR",
    );
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("new-type"));
  });
});
