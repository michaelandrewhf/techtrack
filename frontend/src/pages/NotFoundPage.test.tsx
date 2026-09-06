import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { App } from "../App";
import { tokenStore } from "../api/client";

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  tokenStore.clear();
});

it("shows recovery actions for an unknown authenticated route", async () => {
  tokenStore.set("access-token", "refresh-token");
  window.history.pushState({}, "", "/rota-que-nao-existe");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/v1/me/")) {
        return json({
          id: "user-1",
          username: "tech",
          first_name: "",
          last_name: "",
          email: "",
          is_staff: true,
        });
      }
      return json({ count: 0, next: null, previous: null, results: [] });
    }),
  );

  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Pagina nao encontrada" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Erro 404")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Voltar ao inicio" }),
  ).toHaveAttribute("href", "/");
  expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
});
