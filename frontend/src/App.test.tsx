import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { tokenStore } from "./api/client";

const user = {
  id: "user-1",
  username: "tech",
  first_name: "",
  last_name: "",
  email: "",
  is_staff: true,
};

const dashboard = {
  customers: { active: 2 },
  equipment: { active: 3 },
  work_orders: {
    open: 1,
    in_progress: 1,
    active: 2,
    completed: 0,
    cancelled: 0,
  },
  maintenance: { overdue: 1, upcoming: 0, never_performed: 0 },
  recent_work_orders: [],
  awaiting_customer: [],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setupFetch() {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/token/"))
        return json({ access: "access-token", refresh: "refresh-token" });
      if (url.endsWith("/api/v1/me/")) {
        if (init?.method === "PATCH") {
          return json({ ...user, first_name: "Michael" });
        }
        return json(user);
      }
      if (url.endsWith("/api/v1/dashboard/")) return json(dashboard);
      if (url.includes("/api/v1/work-orders/wo-1/")) {
        return json(workOrderDetail);
      }
      if (url.includes("/api/v1/work-order-statuses/")) {
        return json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: "status-2",
              name: "Em testes",
              code: "testing",
              kind: "active",
              is_active: true,
            },
          ],
        });
      }
      if (url.includes("/api/v1/payment-methods/")) {
        return json({ count: 0, next: null, previous: null, results: [] });
      }
      return json({ count: 0, next: null, previous: null, results: [] });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const workOrderDetail = {
  id: "wo-1",
  number: 1,
  display_number: "OS #000001",
  customer: {
    id: "c1",
    name: "Cliente A",
    phone: "",
    whatsapp: "",
    email: "",
    status: "active",
  },
  equipment: {
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
      id: "et1",
      name: "Notebook",
      slug: "notebook",
      is_active: true,
    },
    manufacturer: "Dell",
    model: "Latitude",
    serial_number: "",
    asset_tag: "",
    status: "active",
  },
  status: {
    id: "status-1",
    name: "Aberta",
    code: "open",
    kind: "active",
    is_active: true,
  },
  priority: "normal",
  title: "Notebook sem video",
  problem_description: "Tela preta",
  opened_at: "2026-01-01T10:00:00Z",
  status_history: [],
  services: [],
  parts: [],
  billing: null,
};

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    tokenStore.clear();
    document.documentElement.classList.remove("dark");
  });

  it("redirects protected routes to login", async () => {
    window.history.pushState({}, "", "/customers");
    setupFetch();

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Entrar no sistema" }),
    ).toBeInTheDocument();
  });

  it("logs in and opens the dashboard", async () => {
    window.history.pushState({}, "", "/login");
    setupFetch();

    render(<App />);
    await userEvent.type(screen.getByLabelText(/Usuario/), "tech");
    await userEvent.type(screen.getByLabelText(/Senha/), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Clientes ativos")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the password, remembers the username and exposes password recovery", async () => {
    window.history.pushState({}, "", "/login");
    setupFetch();

    render(<App />);
    const password = screen.getByLabelText(/Senha/) as HTMLInputElement;
    expect(password.type).toBe("password");

    await userEvent.click(
      screen.getByRole("button", { name: "Mostrar senha" }),
    );
    expect(password.type).toBe("text");

    await userEvent.type(screen.getByLabelText(/Usuario/), "tech");
    await userEvent.type(password, "secret");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Lembrar meu usuario" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Esqueci minha senha" }),
    );
    expect(
      screen.getByText(/A recuperacao de senha sera disponibilizada/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Clientes ativos")).toBeInTheDocument();
    expect(localStorage.getItem("techtrack.rememberedUsername")).toBe("tech");
  });

  it("switches dark mode and persists the preference", async () => {
    tokenStore.set("access-token", "refresh-token");
    window.history.pushState({}, "", "/");
    setupFetch();

    render(<App />);
    expect(await screen.findByText("Clientes ativos")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Usar tema escuro" }),
    );

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("techtrack.theme")).toBe("dark");
  });

  it("updates the authenticated profile", async () => {
    tokenStore.set("access-token", "refresh-token");
    window.history.pushState({}, "", "/profile");
    const fetchMock = setupFetch();

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Meu perfil" }),
    ).toBeInTheDocument();

    const firstName = screen.getByLabelText("Nome");
    await userEvent.type(firstName, "Michael");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar perfil" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/me/",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(
      await screen.findByText("Perfil atualizado com sucesso."),
    ).toBeInTheDocument();
  });

  it("calls the change-status action from the work order detail screen", async () => {
    tokenStore.set("access-token", "refresh-token");
    window.history.pushState({}, "", "/work-orders/wo-1");
    const fetchMock = setupFetch();

    render(<App />);
    await screen.findByRole("heading", { name: "OS #000001" });
    await userEvent.selectOptions(
      screen.getByLabelText("Alterar status"),
      "status-2",
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/work-orders/wo-1/change-status/",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
