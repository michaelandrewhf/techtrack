import type { UseFormReturn } from "react-hook-form";

import { Modal } from "../../components/Modal";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
} from "../../components/ui";
import { errorMessage } from "../../utils/errors";
import type { CustomerForm } from "./detail";

export function CustomerEditDialog({
  open,
  form,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  form: UseFormReturn<CustomerForm>;
  pending: boolean;
  error: unknown;
  onSubmit: (data: CustomerForm) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Editar cliente"
      description="Atualize os dados sem sair do contexto do cliente."
      onClose={onClose}
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Field
          label="Nome"
          required
          error={form.formState.errors.name?.message}
        >
          <Input
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
        </Field>
        <Field label="Status">
          <Select {...form.register("status")}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="prospect">Prospect</option>
            <option value="blocked">Bloqueado</option>
          </Select>
        </Field>
        <Field label="Telefone">
          <Input {...form.register("phone")} />
        </Field>
        <Field label="WhatsApp">
          <Input {...form.register("whatsapp")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            <Input
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Observacoes">
            <Textarea {...form.register("notes")} />
          </Field>
        </div>
        {error ? (
          <div className="sm:col-span-2">
            <Notice tone="danger">{errorMessage(error)}</Notice>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={pending} type="submit">
            Salvar alteracoes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
