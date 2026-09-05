import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { quotesApi } from "../../../api/endpoints";
import type { Quote } from "../../../api/types";
import { Modal } from "../../../components/Modal";
import { Button, Field, Input, Notice, Textarea } from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";

const editSchema = z.object({
  title: z.string().min(1, "Informe o titulo."),
  description: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  discount: z.string().optional(),
});

type EditForm = z.input<typeof editSchema>;

export function QuoteEditDialog({
  quote,
  open,
  onClose,
  onChanged,
}: {
  quote: Quote;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const form = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: quote.title,
      description: quote.description,
      valid_until: quote.valid_until ?? "",
      notes: quote.notes,
      discount: quote.discount,
    });
  }, [form, open, quote]);

  const updateQuote = useMutation({
    mutationFn: (data: EditForm) =>
      quotesApi.update(quote.id, {
        title: data.title,
        description: data.description ?? "",
        valid_until: data.valid_until || null,
        notes: data.notes ?? "",
        discount: data.discount || "0",
      }),
    onSuccess: async () => {
      onClose();
      await onChanged();
    },
  });

  return (
    <Modal
      open={open}
      title="Editar orcamento"
      description="Altere os dados comerciais enquanto o workflow permitir edicao."
      size="lg"
      onClose={onClose}
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((data) => updateQuote.mutate(data))}
      >
        <div className="sm:col-span-2">
          <Field
            label="Titulo"
            required
            error={form.formState.errors.title?.message}
          >
            <Input {...form.register("title")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Descricao">
            <Textarea rows={5} {...form.register("description")} />
          </Field>
        </div>
        <Field label="Validade">
          <Input type="date" {...form.register("valid_until")} />
        </Field>
        <Field label="Desconto geral">
          <Input inputMode="decimal" {...form.register("discount")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observacoes">
            <Textarea rows={4} {...form.register("notes")} />
          </Field>
        </div>
        {updateQuote.error ? (
          <div className="sm:col-span-2">
            <Notice tone="danger">{errorMessage(updateQuote.error)}</Notice>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={updateQuote.isPending} type="submit">
            Salvar alteracoes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
