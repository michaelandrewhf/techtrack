import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { toast, ToastProvider } from "./Toast";

it("announces and dismisses global feedback", async () => {
  render(
    <ToastProvider>
      <button type="button" onClick={() => toast.success("Cliente salvo.")}>
        Salvar
      </button>
    </ToastProvider>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

  expect(await screen.findByText("Cliente salvo.")).toBeInTheDocument();
  expect(screen.getByText("Concluido")).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("button", { name: "Fechar notificacao" }),
  );

  expect(screen.queryByText("Cliente salvo.")).not.toBeInTheDocument();
});
