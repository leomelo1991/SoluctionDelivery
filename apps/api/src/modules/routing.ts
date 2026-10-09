import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OpenRouteServiceProvider, OpenRouteError } from './openrouteservice.js';
import { z } from 'zod';
import { config } from '../config.js';
import { Database } from '../database.js';
import type { AddressDto } from '../http/dto.js';
export interface Coordinate {
  latitude: number;
  longitude: number;
}
export interface RouteResult {
  distanceM: number;
  durationSeconds: number;
  provider: 'mapbox' | 'google' | 'openrouteservice';
}
export interface RoutingProvider {
  enabled: boolean;
  route(origin: AddressDto, destination: AddressDto): Promise<RouteResult>;
}
export const addressText = (a: AddressDto) =>
  `${a.street}, ${a.number}, ${a.district}, ${a.city}, ${a.state}, ${a.postalCode}, Brasil`;
class ProviderError extends Error {
  constructor(readonly technical: boolean) {
    super(technical ? 'PROVIDER_UNAVAILABLE' : 'ADDRESS_INVALID');
  }
}
async function http<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new ProviderError(![400, 404, 422].includes(response.status));
    return schema.parse(await response.json());
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(true);
  }
}
const mapGeocode = z.object({
  features: z
    .array(
      z.object({
        properties: z
          .object({ match_code: z.object({ confidence: z.string() }).optional() })
          .optional(),
        geometry: z.object({ coordinates: z.tuple([z.number().finite(), z.number().finite()]) }),
      }),
    )
    .optional(),
});
const mapDirections = z.object({
  code: z.string(),
  routes: z
    .array(z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative() }))
    .optional(),
});
const googleGeocode = z.object({
  status: z.string(),
  results: z
    .array(z.object({ place_id: z.string(), partial_match: z.boolean().optional() }))
    .optional(),
});
const googleDirections = z.object({
  routes: z
    .array(
      z.object({
        distanceMeters: z.number().int().nonnegative(),
        duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
      }),
    )
    .optional(),
});
@Injectable()
export class MapboxProvider implements RoutingProvider {
  enabled = !!config.MAPBOX_TOKEN;
  async route(origin: AddressDto, destination: AddressDto): Promise<RouteResult> {
    const geocode = async (a: AddressDto) => {
      const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
      url.search = new URLSearchParams({
        q: addressText(a),
        country: 'br',
        limit: '2',
        access_token: config.MAPBOX_TOKEN!,
      }).toString();
      const data = await http(url.toString(), mapGeocode);
      if (data.features?.length !== 1) throw new ProviderError(false);
      const feature = data.features[0];
      if (feature.properties?.match_code?.confidence === 'low') throw new ProviderError(false);
      return feature.geometry.coordinates as [number, number];
    };
    const [a, b] = await Promise.all([geocode(origin), geocode(destination)]);
    const url = new URL(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${a.join(',')};${b.join(',')}`,
    );
    url.search = new URLSearchParams({
      access_token: config.MAPBOX_TOKEN!,
      overview: 'false',
      alternatives: 'false',
    }).toString();
    const data = await http(url.toString(), mapDirections);
    const route = data.routes?.[0];
    if (!route || data.code !== 'Ok') throw new ProviderError(false);
    return {
      distanceM: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      provider: 'mapbox',
    };
  }
}
@Injectable()
export class GoogleProvider implements RoutingProvider {
  enabled = !!config.GOOGLE_MAPS_KEY;
  async navigate(origin: Coordinate, destination: AddressDto) {
    const data = await http(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      z.object({
        routes: z
          .array(
            z.object({
              distanceMeters: z.number().int().min(0).max(2000000),
              duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
              polyline: z.object({
                geoJsonLinestring: z.object({
                  type: z.literal('LineString'),
                  coordinates: z
                    .array(
                      z.tuple([
                        z.number().finite().min(-180).max(180),
                        z.number().finite().min(-90).max(90),
                      ]),
                    )
                    .min(2)
                    .max(10000),
                }),
              }),
            }),
          )
          .optional(),
      }),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.GOOGLE_MAPS_KEY!,
          'X-Goog-FieldMask':
            'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring',
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } },
          },
          destination: { address: addressText(destination) },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
          polylineEncoding: 'GEO_JSON_LINESTRING',
          polylineQuality: 'OVERVIEW',
        }),
      },
    );
    const route = data.routes?.[0];
    if (!route) throw new ProviderError(false);
    return {
      provider: 'google' as const,
      distanceM: route.distanceMeters,
      durationSeconds: Math.round(parseFloat(route.duration)),
      coordinates: route.polyline.geoJsonLinestring.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
    };
  }

  async route(origin: AddressDto, destination: AddressDto): Promise<RouteResult> {
    const geocode = async (a: AddressDto) => {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.search = new URLSearchParams({
        address: addressText(a),
        components: 'country:BR',
        key: config.GOOGLE_MAPS_KEY!,
      }).toString();
      const data = await http(url.toString(), googleGeocode);
      if (['OVER_QUERY_LIMIT', 'REQUEST_DENIED', 'UNKNOWN_ERROR'].includes(data.status))
        throw new ProviderError(true);
      if (data.results?.length !== 1 || data.results[0].partial_match)
        throw new ProviderError(false);
      return data.results[0].place_id as string;
    };
    const [a, b] = await Promise.all([geocode(origin), geocode(destination)]);
    const data = await http(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      googleDirections,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.GOOGLE_MAPS_KEY!,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
        },
        body: JSON.stringify({
          origin: { placeId: a },
          destination: { placeId: b },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      },
    );
    const route = data.routes?.[0];
    if (!route) throw new ProviderError(false);
    return {
      distanceM: route.distanceMeters,
      durationSeconds: Math.round(parseFloat(route.duration)),
      provider: 'google',
    };
  }
}
@Injectable()
export class RoutingService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(MapboxProvider) private mapbox: MapboxProvider,
    @Inject(GoogleProvider) private google: GoogleProvider,
    @Inject(OpenRouteServiceProvider) private ors: OpenRouteServiceProvider,
  ) {}
  async route(tenantId: string, origin: AddressDto, destination: AddressDto) {
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const first = tenant.routingPrimary === 'mapbox' ? this.mapbox : this.google;
    const second = tenant.routingPrimary === 'mapbox' ? this.google : this.mapbox;
    const providers =
      config.ROUTING_PROVIDER === 'openrouteservice'
        ? [this.ors]
        : tenant.routingFallback
          ? [first, second]
          : [first];
    for (const provider of providers) {
      if (!provider.enabled) continue;
      try {
        const route = await provider.route(origin, destination);
        if (!Number.isInteger(route.distanceM) || route.distanceM < 0 || route.distanceM > 2000000)
          throw new ProviderError(false);
        return route;
      } catch (e) {
        if ((e instanceof ProviderError || e instanceof OpenRouteError) && !e.technical)
          throw new BadRequestException({
            code: 'ADDRESS_AMBIGUOUS',
            message:
              'Endereço não localizado ou ambíguo. Confira número, bairro, cidade e CEP, ou informe distância manual.',
          });
      }
    }
    throw new ServiceUnavailableException({
      code: 'ROUTING_UNAVAILABLE',
      message: 'Não foi possível calcular a rota. Use tarifa regional ou informe distância manual.',
    });
  }
}
