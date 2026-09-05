import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  it("moves focus into the dialog and restores it when closed", () => {
    const opener = document.createElement("button");
    opener.textContent = "Abrir";
    document.body.appendChild(opener);
    opener.focus();

    const onClose = vi.fn();
    const { rerender } = render(
      <Modal
        description="Descricao do modal"
        onClose={onClose}
        open
        title="Editar cliente"
      >
        <button type="button">Salvar</button>
      </Modal>,
    );

    expect(
      screen.getByRole("dialog", { name: "Editar cliente" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal
        description="Descricao do modal"
        onClose={onClose}
        open={false}
        title="Editar cliente"
      >
        <button type="button">Salvar</button>
      </Modal>,
    );

    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    opener.remove();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} open title="Confirmar acao">
        <button type="button">Confirmar</button>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
