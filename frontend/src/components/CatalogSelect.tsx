import { Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { catalogApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { CatalogItem } from "../api/types";
import { errorMessage } from "../utils/errors";
import { Button, Field, Input, Select } from "./ui";

type Props = {
  label: string;
  resource: string;
  value?: string;
  onChange: (value: string) => void;
  allowInlineCreate?: boolean;
};

export function CatalogSelect({
  label,
  resource,
  value,
  onChange,
  allowInlineCreate = true,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const api = catalogApi(resource);
  const query = useQuery({
    queryKey: queryKeys.catalog(resource, { is_active: true }),
    queryFn: () => api.list({ is_active: true }),
  });
  const createMutation = useMutation({
    mutationFn: () => {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      return api.create({ name, slug });
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["catalog", resource] });
      onChange(created.id);
      setName("");
      setCreating(false);
    },
  });

  const items = query.data?.results ?? [];

  return (
    <div className="space-y-2">
      <Field label={label}>
        <div className="flex gap-2">
          <Select
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">Selecione</option>
            {items.map((item: CatalogItem) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          {allowInlineCreate ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCreating((current) => !current)}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Novo</span>
            </Button>
          ) : null}
        </div>
      </Field>
      {creating ? (
        <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex gap-2">
            <Input
              placeholder="Nome do novo item"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              disabled={!name || createMutation.isPending}
              type="button"
              onClick={() => createMutation.mutate()}
            >
              Criar
            </Button>
          </div>
          {createMutation.error ? (
            <p className="mt-2 text-sm text-red-600">
              {errorMessage(createMutation.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
