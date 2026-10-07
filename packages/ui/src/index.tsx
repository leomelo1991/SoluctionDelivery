import { useRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
export function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="20" fill="var(--ink)" />
        <circle cx="20" cy="20" r="12" fill="none" stroke="var(--bg)" strokeWidth="3" />
        <circle cx="20" cy="20" r="5" fill="var(--accent)" />
      </svg>
      <span>
        <strong>Solution</strong>
        <span>Delivery</span>
      </span>
    </div>
  );
}
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}
export function Field({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
export function Status({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'danger' | 'warning';
}) {
  return (
    <span className={`status ${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Metric({
  label,
  value,
  context,
}: {
  label: string;
  value: ReactNode;
  context?: ReactNode;
}) {
  return (
    <Card className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {context && <small>{context}</small>}
    </Card>
  );
}
export function Empty({
  title = 'Nenhum registro',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol" aria-hidden="true">
        ○
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      Carregando informações…
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      <Button variant="secondary" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement),
  );
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (document.querySelector('[role="dialog"]')) return;
            const target = returnFocus.current?.isConnected
              ? returnFocus.current
              : document.querySelector<HTMLElement>('main h1');
            if (target) {
              if (target.tagName === 'H1') target.tabIndex = -1;
              target.focus();
            }
          }}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Fechar diálogo">
                ×
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={description ? '' : 'sr-only'}>
            {description ?? title}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>
        {total} registros · Página {page} de {last}
      </span>
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <Button variant="secondary" disabled={page >= last} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}
