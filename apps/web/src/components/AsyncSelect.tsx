import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import type { Page } from '@solution/contracts';
import { Button } from '@solution/ui';
import { useData } from '../lib/query';
import { useDraftState } from '../lib/drafts';
type Option = { id: string; name?: string; code?: number };
const optionLabel = (option: Option) =>
  option.name ?? (option.code !== undefined ? `Entrega #${option.code}` : option.id);
export function AsyncSelect({
  id,
  label,
  source,
  value,
  onChange,
  draftKey,
}: {
  id: string;
  label: string;
  source: string;
  value: string;
  onChange: (value: string) => void;
  draftKey?: string;
}) {
  const [search, setSearch] = useDraftState(draftKey ?? null, '');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [chosen, setChosen] = useState<Option | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const query = useData<Page<Option>>(
    source +
      (source.includes('?') ? '&' : '?') +
      new URLSearchParams({ q: search, page: String(page), pageSize: '30' }),
  );
  const options = query.data?.items ?? [];
  const selected = options.find((o) => o.id === value) ?? (chosen?.id === value ? chosen : null);
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  const choose = (option: Option | null) => {
    setChosen(option);
    onChange(option?.id ?? '');
    setSearch('');
    setPage(1);
    close(true);
  };
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (active >= 0)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id]);
  return (
    <div
      className="async-select"
      data-escape-boundary={open || undefined}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        id={id}
        ref={trigger}
        type="button"
        className="async-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => {
          setOpen(!open);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive(-1);
          }
        }}
      >
        <span>
          {value ? (selected ? optionLabel(selected) : 'Registro selecionado') : 'Selecione'}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="async-select-popup">
          <div className="async-select-search">
            <Search size={18} aria-hidden="true" />
            <input
              ref={input}
              role="combobox"
              aria-label={`Buscar ${label.toLowerCase()}`}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={
                active >= 0 && options[active] ? `${id}-option-${active}` : undefined
              }
              placeholder="Buscar na lista…"
              value={search}
              onChange={(event) => {
                if (selected) setChosen(selected);
                setSearch(event.target.value);
                setPage(1);
                setActive(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActive((index) =>
                    options.length
                      ? index < 0
                        ? event.key === 'ArrowDown'
                          ? 0
                          : options.length - 1
                        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
                          options.length
                      : -1,
                  );
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (options[active]) choose(options[active]);
                }
              }}
            />
          </div>
          {query.isLoading && <p role="status">Carregando…</p>}
          {query.error && (
            <div role="alert">
              <p>{query.error.message}</p>
              <Button type="button" variant="ghost" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!query.isLoading && !query.error && !options.length && (
            <p role="status">Nenhum resultado encontrado.</p>
          )}
          <ul id={`${id}-list`} role="listbox" aria-label={label} className="async-select-options">
            {options.map((option, index) => (
              <li
                key={option.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={value === option.id}
                className={active === index ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span>{optionLabel(option)}</span>
                {value === option.id && <Check size={18} aria-hidden="true" />}
              </li>
            ))}
          </ul>
          <div className="async-select-footer">
            {value && (
              <Button type="button" variant="ghost" onClick={() => choose(null)}>
                Limpar seleção
              </Button>
            )}
            {query.data && query.data.total > 30 && (
              <div className="actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page === 1}
                  onClick={() => {
                    if (selected) setChosen(selected);
                    setPage((p) => p - 1);
                    setActive(-1);
                  }}
                >
                  Anterior
                </Button>
                <span className="muted">Página {page}</span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page * 30 >= query.data.total}
                  onClick={() => {
                    if (selected) setChosen(selected);
                    setPage((p) => p + 1);
                    setActive(-1);
                  }}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
