import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { AsyncEntityCombobox } from "./AsyncEntityCombobox";

it("searches remotely and returns only the selected entity id", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const loadOptions = vi.fn(async (search: string) =>
    search
      ? [{ id: "customer-1", label: "Acme Tecnologia" }]
      : [],
  );
  const onChange = vi.fn();

  render(
    <QueryClientProvider client={client}>
      <AsyncEntityCombobox
        loadOptions={loadOptions}
        queryKey={["test", "customers"]}
        value=""
        onChange={onChange}
      />
    </QueryClientProvider>,
  );

  const input = screen.getByRole("combobox");
  await userEvent.type(input, "Acme");

  expect(
    await screen.findByRole("option", { name: "Acme Tecnologia" }),
  ).toBeInTheDocument();
  await waitFor(() => expect(loadOptions).toHaveBeenCalledWith("Acme"));

  await userEvent.click(
    screen.getByRole("option", { name: "Acme Tecnologia" }),
  );
  expect(onChange).toHaveBeenCalledWith("customer-1");
  expect(input).toHaveValue("Acme Tecnologia");
});
