import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";

import { TabPanel, Tabs } from "./Tabs";

function Harness() {
  const [value, setValue] = useState("overview");
  return (
    <>
      <Tabs
        id="customer-tabs"
        items={[
          { id: "overview", label: "Visao geral" },
          { id: "equipment", label: "Equipamentos" },
          { id: "finance", label: "Financeiro" },
        ]}
        value={value}
        onChange={setValue}
      />
      <TabPanel tabsId="customer-tabs" tabId={value}>
        Conteudo {value}
      </TabPanel>
    </>
  );
}

it("links tabs to panels and supports arrow, home and end navigation", async () => {
  render(<Harness />);

  const overview = screen.getByRole("tab", { name: "Visao geral" });
  const equipment = screen.getByRole("tab", { name: "Equipamentos" });
  const finance = screen.getByRole("tab", { name: "Financeiro" });

  expect(overview).toHaveAttribute("aria-selected", "true");
  expect(overview).toHaveAttribute("aria-controls", "customer-tabs-panel-overview");
  expect(screen.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    "customer-tabs-tab-overview",
  );

  overview.focus();
  await userEvent.keyboard("{ArrowRight}");
  await waitFor(() => expect(equipment).toHaveFocus());
  expect(equipment).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Conteudo equipment");

  await userEvent.keyboard("{End}");
  await waitFor(() => expect(finance).toHaveFocus());

  await userEvent.keyboard("{Home}");
  await waitFor(() => expect(overview).toHaveFocus());
});
