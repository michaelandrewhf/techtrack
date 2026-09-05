import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EquipmentDetailPage } from "./EquipmentDetailPage";

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/equipment/eq1"]}>
        <Routes>
          <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const equipment = {
  id: "eq1",
  customer: {
    id: "c1",
    name: "Cliente A",
    phone: "",
    whatsapp: "",
    email: "",
    status: "active",
  },
  equipment_type: {
    id: "type1",
    name: "Notebook",
    is_active: true,
  },
  manufacturer: "Dell",
  model: "Latitude",
  serial_number: "SN1",
  asset_tag: "PAT1",
  operating_system: "Linux",
  notes: "Equipamento principal",
  status: "active",
  current_components: [],
  recent_work_orders: [],
};

describe("EquipmentDetailPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads preventive maintenance only when its tab is opened", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/equipment/eq1/")) return json(equipment);
      if (url.endsWith("/api/v1/equipment/eq1/maintenance/")) return json([]);
      return json({ count: 0, next: null, previous: null, results: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Dell Latitude" }),
    ).toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/v1/equipment/eq1/maintenance/"),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole("tab", { name: "Manutencao" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/v1/equipment/eq1/maintenance/"),
        ),
      ).toBe(true);
    });
  });
});
