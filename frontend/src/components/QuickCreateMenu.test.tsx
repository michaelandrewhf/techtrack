import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Boxes, Users } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";

import { QuickCreateMenu } from "./QuickCreateMenu";

it("opens with arrows, moves through items and restores focus on escape", async () => {
  render(
    <MemoryRouter>
      <QuickCreateMenu
        items={[
          { to: "/customers?new=1", label: "Cliente", icon: Users },
          { to: "/equipment?new=1", label: "Equipamento", icon: Boxes },
        ]}
      />
    </MemoryRouter>,
  );

  const trigger = screen.getByRole("button", { name: /Novo/ });
  trigger.focus();

  await userEvent.keyboard("{ArrowDown}");
  const customer = await screen.findByRole("menuitem", { name: "Cliente" });
  const equipment = screen.getByRole("menuitem", { name: "Equipamento" });
  await waitFor(() => expect(customer).toHaveFocus());

  await userEvent.keyboard("{ArrowDown}");
  expect(equipment).toHaveFocus();

  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
