import { useEffect, useId, useRef, type KeyboardEvent } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Rótulo mostrado no botão de confirmação enquanto a ação está em andamento. */
  busyLabel?: string;
  busy?: boolean;
  /** `danger` pinta a ação de confirmação como destrutiva. */
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmação modal acessível: prende o foco, fecha com `Esc` ou clique no fundo
 * e devolve o foco ao elemento de origem. Substitui `window.confirm`, que ignora
 * o tema da aplicação e não é verificável em testes.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  busyLabel = 'Aguarde…',
  busy = false,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => restoreRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.stopPropagation(); onCancel(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div
      ref={dialogRef}
      className="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy || undefined}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <h2 id={titleId}>{title}</h2>
      {description && <p id={descriptionId}>{description}</p>}
      <div className="confirm-actions">
        <button type="button" className="confirm-button confirm-cancel" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={`confirm-button ${tone === 'danger' ? 'confirm-danger' : 'confirm-primary'}`} disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </div>
  </div>;
}
