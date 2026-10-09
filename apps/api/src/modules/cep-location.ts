import { z } from 'zod';
const coordinate = (limit: number) =>
  z
    .union([z.number(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().finite().min(-limit).max(limit));
const responseSchema = z.object({
  cep: z.string(),
  city: z.string(),
  state: z.literal('SP'),
  street: z.string(),
  neighborhood: z.string(),
  location: z.object({
    coordinates: z.object({ latitude: coordinate(90), longitude: coordinate(180) }),
  }),
});
/** A CEP coordinate is approximate, never an exact building or a live courier position. */
export async function francaCep(cep: string) {
  const digits = cep.replace(/\D/g, '');
  if (!/^144\d{5}$/.test(digits)) return null;
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const data = parsed.data;
    if (data.cep.replace(/\D/g, '') !== digits || data.city.toLowerCase() !== 'franca') return null;
    const point = data.location.coordinates;
    if (
      point.latitude < -21 ||
      point.latitude > -20 ||
      point.longitude < -48 ||
      point.longitude > -47
    )
      return null;
    return { cep: digits, street: data.street, district: data.neighborhood, point };
  } catch {
    return null;
  }
}
