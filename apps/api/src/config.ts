import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});
import { z } from 'zod';
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    UPSTASH_REDIS_REST_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    UPSTASH_REDIS_REST_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    APP_ORIGIN: z.string().url().default('http://localhost:5173'),
    OPENROUTESERVICE_API_KEY: z.string().optional(),
    ROUTING_PROVIDER: z.enum(['openrouteservice', 'legacy']).default('openrouteservice'),
    MAPBOX_TOKEN: z.string().optional(),
    GOOGLE_MAPS_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const rest = Boolean(value.UPSTASH_REDIS_REST_URL && value.UPSTASH_REDIS_REST_TOKEN);
    if (Boolean(value.UPSTASH_REDIS_REST_URL) !== Boolean(value.UPSTASH_REDIS_REST_TOKEN))
      ctx.addIssue({
        code: 'custom',
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'Upstash exige URL e token juntos.',
      });
    if (!rest && !value.REDIS_URL)
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'Configure Redis TCP ou Upstash REST.',
      });
    if (value.NODE_ENV === 'production' && !value.APP_ORIGIN.startsWith('https://'))
      ctx.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'Produção exige APP_ORIGIN com HTTPS.',
      });
  });
export const config = schema.parse(process.env);
