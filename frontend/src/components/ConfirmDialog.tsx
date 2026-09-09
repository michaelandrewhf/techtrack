import { useState } from "react";

import { Modal } from "./Modal";
import { Button } from "./ui";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span
        className="inline-flex"
        role="presentation"
        onClick={() => setOpen(true)}
      >
        {children}
      </span>
      <Modal
        open={open}
        size="sm"
        title={title}
        description={description}
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
