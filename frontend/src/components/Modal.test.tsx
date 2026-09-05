import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Modal } from "./Modal";

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir modal
      </button>
      <Modal
        description="Descricao de teste"
        open={open}
        title="Modal de teste"
        onClose={() => setOpen(false)}
      >
        <button type="button">Primeira acao</button>
        <button type="button">Segunda acao</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("moves focus into the dialog and restores it after closing", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole("button", { name: "Abrir modal" });
    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps tab focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole("button", { name: "Abrir modal" }));
    const close = screen.getByRole("button", { name: "Fechar" });
    const first = screen.getByRole("button", { name: "Primeira acao" });
    const second = screen.getByRole("button", { name: "Segunda acao" });

    expect(close).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(second).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });
});
