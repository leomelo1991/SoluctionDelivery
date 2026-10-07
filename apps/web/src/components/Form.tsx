import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@solution/ui';
import { AsyncSelect } from './AsyncSelect';
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
}: {
  fields: FormField[];
  initial?: object;
  onSubmit: (values: Values) => Promise<unknown> | void;
  submitLabel?: string;
  busy?: boolean;
  onDirty?: () => void;
  children?: React.ReactNode;
}) {
  const defaults = Object.fromEntries(
    fields.map((f) => {
      const raw = (initial as Record<string, unknown>)[f.name] ?? f.default ?? '';
      return [
        f.name,
        String(
          typeof raw === 'number'
            ? raw / (['money', 'percent'].includes(f.kind ?? '') ? 100 : f.kind === 'km' ? 1000 : 1)
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
  } = useForm<Record<string, string>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  return (
    <form
      className="form-grid"
      onChangeCapture={onDirty}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
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
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
          ) : f.kind === 'select' ? (
            <select id={`f-${f.name}`} {...register(f.name)}>
              {f.required !== false && <option value="">Selecione</option>}
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.kind === 'textarea' ? (
            <textarea id={`f-${f.name}`} {...register(f.name)} />
          ) : (
            <input
              id={`f-${f.name}`}
              type={
                ['money', 'percent', 'km', 'number'].includes(f.kind ?? '')
                  ? 'number'
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
              autoComplete={f.kind === 'password' ? 'new-password' : undefined}
              aria-invalid={!!errors[f.name]}
              {...register(f.name)}
            />
          )}{' '}
          {errors[f.name] && <span className="field-error">{String(errors[f.name]?.message)}</span>}
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
