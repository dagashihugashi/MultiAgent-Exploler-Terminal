interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Minimal in-app confirmation; avoids depending on the native dialog plugin. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-96 rounded border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-200 shadow-2xl"
      >
        <h2 className="mb-2 font-semibold">{title}</h2>
        <p className="mb-4 text-neutral-400">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-neutral-700 px-3 py-1 hover:bg-neutral-800"
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            type="button"
            autoFocus
            className="rounded bg-red-700 px-3 py-1 text-white hover:bg-red-600"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
