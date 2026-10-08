import { useState } from 'react';
import type { Page } from '@solution/contracts';
import { Button } from '@solution/ui';
import { useData } from '../lib/query';
import { useDraftState } from '../lib/drafts';
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
  const [chosen, setChosen] = useState<{ id: string; name?: string; code?: number } | null>(null);
  const query = useData<Page<{ id: string; name?: string; code?: number }>>(
    source +
      (source.includes('?') ? '&' : '?') +
      new URLSearchParams({ q: search, page: String(page), pageSize: '30' }).toString(),
  );
  const options = query.data?.items ?? [];
  return (
    <div className="async-select">
      <input
        aria-label={`Buscar ${label.toLowerCase()}`}
        placeholder="Digite para buscar"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setChosen(options.find((o) => o.id === v) ?? null);
          onChange(v);
        }}
      >
        <option value="">{query.isLoading ? 'Carregando…' : 'Selecione'}</option>
        {value && !options.some((o) => o.id === value) && (
          <option value={value}>{chosen?.name ?? 'Registro selecionado'}</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name ?? (o.code !== undefined ? `Entrega #${o.code}` : o.id)}
          </option>
        ))}
      </select>
      {query.error && (
        <span className="field-error" role="alert">
          {query.error.message}
        </span>
      )}
      {query.data && query.data.total > 30 && (
        <div className="actions">
          <Button
            type="button"
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="muted">Página {page}</span>
          <Button
            type="button"
            variant="ghost"
            disabled={page * 30 >= query.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
