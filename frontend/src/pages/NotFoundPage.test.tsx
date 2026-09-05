import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NotFoundPage } from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("offers recovery navigation", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Pagina nao encontrada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ir para o inicio/i }),
    ).toHaveAttribute("href", "/");
  });
});
