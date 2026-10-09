import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@solution/ui';
import { AsyncSelect } from './AsyncSelect';
import { clearDraft, readDraft, useDraftKey, writeDraft } from '../lib/drafts';
export interface FormField {
  name: string;
  label: string;
  kind?:
    | 'text'
    | 'email'
    | 'password'
    | 'textarea'
    | 'select'
    | 'money'
    | 'number'
    | 'km'
    | 'percent'
    | 'datetime-local';
  source?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  full?: boolean;
  default?: string | number;
  autoComplete?: string;
  placeholder?: string;
}
export type Values = Record<string, string | number | undefined>;
const schemaFor = (f: FormField) => {
  if (['number', 'money', 'km', 'percent'].includes(f.kind ?? '')) {
    const numeric = z
      .string()
      .min(1, 'Informe um valor.')
      .refine(
        (v) =>
          Number.isFinite(Number(v)) && Number(v) >= (f.min ?? 0) && Number(v) <= (f.max ?? 100000),
        'Valor fora do intervalo permitido.',
      )
      .transform((v) => {
        const n = Number(v);
        return Math.round(
          n * (f.kind === 'money' || f.kind === 'percent' ? 100 : f.kind === 'km' ? 1000 : 1),
        );
      });
    return f.required === false
      ? z.union([z.literal('').transform(() => undefined), numeric])
      : numeric;
  }
  let s = f.kind === 'password' ? z.string() : z.string().trim();
  if (f.required !== false) s = s.min(f.min ?? 1, 'Preencha este campo.');
  if (f.max) s = s.max(f.max, 'Texto muito longo.');
  if (f.kind === 'email') s = s.email('E-mail inválido.');
  return s;
};
export function Form({
  fields,
  initial = {},
  onSubmit,
  submitLabel = 'Salvar',
  busy = false,
  onDirty,
  children,
  draftKey,
  clearDraftOnSubmit = true,
  persistAnonymous = false,
}: {
  fields: FormField[];
  initial?: object;
  onSubmit: (values: Values) => Promise<unknown> | void;
  submitLabel?: string;
  busy?: boolean;
  onDirty?: () => void;
  children?: React.ReactNode;
  draftKey?: string;
  clearDraftOnSubmit?: boolean;
  persistAnonymous?: boolean;
}) {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const scopedKey = useDraftKey(draftKey ?? '', persistAnonymous);
  const storageKey = draftKey ? scopedKey : null;
  const draft = storageKey ? readDraft<Record<string, string>>(storageKey, {}) : {};
  const defaults = Object.fromEntries(
    fields.map((f) => {
      const raw = (initial as Record<string, unknown>)[f.name] ?? f.default ?? '';
      return [
        f.name,
        (f.kind !== 'password' && typeof draft?.[f.name] === 'string'
          ? draft[f.name]
          : undefined) ??
          String(
            typeof raw === 'number'
              ? raw /
                  (['money', 'percent'].includes(f.kind ?? '') ? 100 : f.kind === 'km' ? 1000 : 1)
              : raw,
          ),
      ];
    }),
  );
  const schema = z.object(Object.fromEntries(fields.map((f) => [f.name, schemaFor(f)])));
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<Record<string, string>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (!storageKey) return;
    const subscription = watch((values) => {
      writeDraft(
        storageKey,
        Object.fromEntries(
          fields
            .filter((field) => field.kind !== 'password')
            .map((field) => [field.name, values[field.name] ?? '']),
        ),
      );
    });
    return () => subscription.unsubscribe();
  }, [watch, storageKey, fields]);
  return (
    <form
      className="form-grid"
      onChangeCapture={onDirty}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
          if (storageKey && clearDraftOnSubmit) clearDraft(storageKey);
        } catch (e) {
          setError('root', { message: e instanceof Error ? e.message : 'Falha ao salvar.' });
        }
      })}
    >
      {fields.map((f) => (
        <div className={`field ${f.full ? 'full' : ''}`} key={f.name}>
          <label htmlFor={`f-${f.name}`}>{f.label}</label>
          {f.source ? (
            <Controller
              name={f.name}
              control={control}
              render={({ field }) => (
                <AsyncSelect
                  id={`f-${f.name}`}
                  label={f.label}
                  source={f.source!}
                  draftKey={draftKey ? `${draftKey}:${f.name}:search` : undefined}
                  value={field.value ?? ''}
                  onChange={(value) => {
                    field.onChange(value);
                    onDirty?.();
                  }}
                />
              )}
            />
          ) : f.kind === 'select' ? (
            <select
              id={`f-${f.name}`}
              aria-invalid={!!errors[f.name]}
              aria-describedby={errors[f.name] ? `f-${f.name}-error` : undefined}
              {...register(f.name)}
            >
              {f.required !== false && <option value="">Selecione</option>}
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.kind === 'textarea' ? (
            <textarea
              id={`f-${f.name}`}
              placeholder={f.placeholder}
              aria-invalid={!!errors[f.name]}
              aria-describedby={errors[f.name] ? `f-${f.name}-error` : undefined}
              {...register(f.name)}
            />
          ) : (
            <div className={f.kind === 'password' ? 'password-input' : 'input-wrap'}>
              <input
                id={`f-${f.name}`}
                type={
                  ['money', 'percent', 'km', 'number'].includes(f.kind ?? '')
                    ? 'number'
                    : f.kind === 'password' && visiblePasswords[f.name]
                      ? 'text'
                      : (f.kind ?? 'text')
                }
                step={
                  f.kind === 'number'
                    ? '1'
                    : f.kind === 'km'
                      ? '0.001'
                      : ['money', 'percent'].includes(f.kind ?? '')
                        ? '0.01'
                        : undefined
                }
                min={
                  ['money', 'percent', 'km', 'number'].includes(f.kind ?? '')
                    ? (f.min ?? 0)
                    : undefined
                }
                max={f.max}
                autoComplete={
                  f.autoComplete ?? (f.kind === 'password' ? 'new-password' : undefined)
                }
                placeholder={f.placeholder}
                aria-invalid={!!errors[f.name]}
                aria-describedby={errors[f.name] ? `f-${f.name}-error` : undefined}
                {...register(f.name)}
              />
              {f.kind === 'password' && (
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visiblePasswords[f.name] ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={!!visiblePasswords[f.name]}
                  onClick={() =>
                    setVisiblePasswords((current) => ({ ...current, [f.name]: !current[f.name] }))
                  }
                >
                  {visiblePasswords[f.name] ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </div>
          )}{' '}
          {errors[f.name] && (
            <span className="field-error" id={`f-${f.name}-error`}>
              {String(errors[f.name]?.message)}
            </span>
          )}
        </div>
      ))}
      {children}
      <div className="full">
        {errors.root && (
          <p className="field-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={busy || isSubmitting}>
          {busy || isSubmitting ? 'Processando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
export const addressFields: FormField[] = [
  { name: 'street', label: 'Rua', min: 2, max: 160, full: true },
  { name: 'number', label: 'Número', max: 20 },
  { name: 'district', label: 'Bairro', min: 2, max: 100 },
  { name: 'city', label: 'Cidade', min: 2, max: 100 },
  { name: 'state', label: 'UF', min: 2, max: 2, default: 'SP' },
  { name: 'postalCode', label: 'CEP', min: 8, max: 9 },
  { name: 'complement', label: 'Complemento', required: false, max: 120 },
];
export function takeAddress(v: Values) {
  return Object.fromEntries(addressFields.map((f) => [f.name, v[f.name]]));
}
export function omitAddress(v: Values) {
  return Object.fromEntries(
    Object.entries(v).filter(([key]) => !addressFields.some((f) => f.name === key)),
  );
}
