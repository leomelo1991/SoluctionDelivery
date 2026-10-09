import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { config } from '../config.js';
import type { AddressDto } from '../http/dto.js';
const point = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const geocoding = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ type: z.literal('Point'), coordinates: point }),
      properties: z.object({ confidence: z.number().min(0).max(1), layer: z.string() }),
    }),
  ),
});
const directions = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          type: z.literal('LineString'),
          coordinates: z.array(point).min(2).max(10000),
        }),
        properties: z.object({
          summary: z.object({
            distance: z.number().finite().min(0).max(2000000),
            duration: z.number().finite().min(0),
          }),
        }),
      }),
    )
    .min(1),
});
export class OpenRouteError extends Error {
  constructor(readonly technical: boolean) {
    super(technical ? 'ROUTING_UNAVAILABLE' : 'ADDRESS_AMBIGUOUS');
  }
}
@Injectable()
export class OpenRouteServiceProvider {
  get enabled() {
    return !!config.OPENROUTESERVICE_API_KEY?.trim();
  }
  private cache = new Map<
    string,
    { point: { latitude: number; longitude: number }; expires: number }
  >();
  private async request(url: URL | string, init?: RequestInit) {
    if (!this.enabled) throw new OpenRouteError(true);
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new OpenRouteError(![400, 404, 422].includes(response.status));
      return await response.json();
    } catch (error) {
      if (error instanceof OpenRouteError) throw error;
      throw new OpenRouteError(true);
    }
  }
  async geocode(address: AddressDto) {
    const text = `${address.street}, ${address.number}, ${address.district}, ${address.city}, ${address.state}, ${address.postalCode}, Brasil`;
    const cached = this.cache.get(text);
    if (cached && cached.expires > Date.now()) return cached.point;
    const url = new URL('https://api.openrouteservice.org/geocode/search');
    url.search = new URLSearchParams({
      api_key: config.OPENROUTESERVICE_API_KEY ?? '',
      text,
      'boundary.country': 'BRA',
      layers: 'address',
      size: '2',
    }).toString();
    const data = geocoding.parse(await this.request(url));
    const feature = data.features[0];
    // Não tratar o centro de uma cidade/rua como o endereço exato de uma entrega.
    if (
      data.features.length !== 1 ||
      !feature ||
      feature.properties.layer !== 'address' ||
      feature.properties.confidence < 0.8
    )
      throw new OpenRouteError(false);
    const [longitude, latitude] = feature.geometry.coordinates;
    const result = { latitude, longitude };
    if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(text, { point: result, expires: Date.now() + 86400000 });
    return result;
  }
  async navigate(origin: { latitude: number; longitude: number }, destination: AddressDto) {
    const target = await this.geocode(destination);
    const data = directions.parse(
      await this.request('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: {
          Authorization: config.OPENROUTESERVICE_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [origin.longitude, origin.latitude],
            [target.longitude, target.latitude],
          ],
          instructions: false,
        }),
      }),
    );
    const route = data.features[0];
    return {
      provider: 'openrouteservice' as const,
      distanceM: Math.round(route.properties.summary.distance),
      durationSeconds: Math.round(route.properties.summary.duration),
      coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
    };
  }
  async route(origin: AddressDto, destination: AddressDto) {
    const result = await this.navigate(await this.geocode(origin), destination);
    return {
      provider: result.provider,
      distanceM: result.distanceM,
      durationSeconds: result.durationSeconds,
    };
  }
}
