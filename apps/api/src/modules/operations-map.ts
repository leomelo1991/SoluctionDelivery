import { francaCep } from './cep-location.js';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  Param,
  ParseUUIDPipe,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';
import { createHash } from 'node:crypto';
import { OpenRouteServiceProvider } from './openrouteservice.js';
import { Database } from '../database.js';
import { RateLimiter, Roles, type AuthRequest } from '../http/security.js';
import type { AddressDto } from '../http/dto.js';
import { addressText } from './routing.js';
import { deliveryScope } from './deliveries.js';

export class CourierPositionDto {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(10000) accuracy!: number;
  @ApiProperty({ description: 'Timestamp original do GPS, em milissegundos Unix.' })
  @IsInt()
  @Min(0)
  observedAt!: number;
}
export function mapAddressHash(address: AddressDto) {
  return createHash('sha256')
    .update(('openrouteservice:' + addressText(address)).normalize('NFC').trim().toLowerCase())
    .digest('hex');
}
@ApiTags('Mapa da operação')
@Controller('operations-map')
export class OperationsMapController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(RateLimiter) private limiter: RateLimiter,
    @Inject(OpenRouteServiceProvider) private ors: OpenRouteServiceProvider,
  ) {}

  @Post('location')
  @Roles('courier')
  @Header('Cache-Control', 'no-store')
  async locate(@Req() r: AuthRequest, @Body() body: CourierPositionDto) {
    const now = Date.now();
    if (body.observedAt < now - 30000 || body.observedAt > now + 5000)
      throw new BadRequestException('Amostra de GPS expirada ou no futuro.');
    if (!r.actor.courierId) throw new ForbiddenException();
    // A checagem de elegibilidade e a escrita fazem parte do mesmo comando.
    // Amostras atrasadas/repetidas jamais substituem uma posição mais recente.
    const updated = await this.db.$executeRaw`
      INSERT INTO "CourierPosition" ("tenantId", "courierId", "latitude", "longitude", "accuracy", "observedAt", "receivedAt")
      SELECT "tenantId", "id", ${body.latitude}, ${body.longitude}, ${body.accuracy}, ${new Date(body.observedAt)}, ${new Date(now)}
      FROM "Courier" WHERE "tenantId" = ${r.actor.tenantId}::uuid AND "id" = ${r.actor.courierId}::uuid
        AND "approvalStatus" = 'approved' AND "availabilityStatus" IN ('available', 'busy')
      ON CONFLICT ("tenantId", "courierId") DO UPDATE SET
        "latitude" = EXCLUDED."latitude", "longitude" = EXCLUDED."longitude", "accuracy" = EXCLUDED."accuracy",
        "observedAt" = EXCLUDED."observedAt", "receivedAt" = EXCLUDED."receivedAt"
      WHERE "CourierPosition"."observedAt" < EXCLUDED."observedAt"`;
    return { accepted: updated === 1 };
  }

  private async entities(r: AuthRequest) {
    const a = r.actor;
    if (a.role === 'establishment' && !a.establishmentId) throw new ForbiddenException();
    const [stores, deliveries] = await Promise.all([
      this.db.establishment.findMany({
        where: {
          tenantId: a.tenantId,
          ...(a.role === 'establishment' ? { id: a.establishmentId! } : {}),
        },
        select: { id: true, name: true, address: true, lifecycleStatus: true, operationOpen: true },
        orderBy: { id: 'asc' },
        take: 1001,
      }),
      this.db.delivery.findMany({
        where: { ...deliveryScope(a), status: { not: 'delivered' } },
        select: {
          id: true,
          code: true,
          version: true,
          status: true,
          courierId: true,
          pickupAddress: true,
          destinationAddress: true,
        },
        orderBy: { id: 'asc' },
        take: 1001,
      }),
    ]);
    return {
      stores: stores.slice(0, 1000),
      deliveries: deliveries.slice(0, 1000),
      truncated: stores.length > 1000 || deliveries.length > 1000,
    };
  }
  private pins(entities: Awaited<ReturnType<OperationsMapController['entities']>>) {
    return [
      ...entities.stores.map((s) => ({
        id: `establishment:${s.id}`,
        kind: 'establishment' as const,
        label: s.name,
        address: s.address as unknown as AddressDto,
        active: s.lifecycleStatus === 'active' && s.operationOpen,
      })),
      ...entities.deliveries.flatMap((d) => [
        {
          id: `pickup:${d.id}`,
          kind: 'pickup' as const,
          label: `Coleta #${d.code}`,
          address: d.pickupAddress as unknown as AddressDto,
          active: ['accepted', 'arrived'].includes(d.status),
          deliveryId: d.id,
          courierId: d.courierId ?? undefined,
        },
        {
          id: `dropoff:${d.id}`,
          kind: 'dropoff' as const,
          label: `Entrega #${d.code}`,
          address: d.destinationAddress as unknown as AddressDto,
          active: d.status === 'collected',
          deliveryId: d.id,
          courierId: d.courierId ?? undefined,
        },
      ]),
    ];
  }

  @Get()
  @Roles('admin', 'establishment')
  @Header('Cache-Control', 'no-store')
  async snapshot(@Req() r: AuthRequest) {
    const entities = await this.entities(r);
    const pins = this.pins(entities);
    const now = new Date();
    const [positions, locations] = await Promise.all([
      this.db.courierPosition.findMany({
        where: {
          tenantId: r.actor.tenantId,
          observedAt: { gte: new Date(now.getTime() - 30000) },
          courier: {
            approvalStatus: 'approved',
            availabilityStatus: { in: ['available', 'busy'] },
            ...(r.actor.role === 'establishment'
              ? {
                  deliveries: {
                    some: {
                      tenantId: r.actor.tenantId,
                      establishmentId: r.actor.establishmentId!,
                      status: { in: ['accepted', 'arrived', 'collected'] },
                    },
                  },
                }
              : {}),
          },
        },
        include: { courier: { select: { name: true, availabilityStatus: true } } },
        orderBy: { courierId: 'asc' },
        take: 1001,
      }),
      this.db.mapGeocode.findMany({
        where: {
          tenantId: r.actor.tenantId,
          addressHash: { in: pins.map((p) => mapAddressHash(p.address)) },
          expiresAt: { gt: now },
        },
      }),
    ]);
    const cache = new Map(locations.map((l) => [l.addressHash, l]));
    return {
      generatedAt: now.toISOString(),
      geocodingEnabled:
        this.ors.enabled ||
        pins.some((p) => p.address.city.toLowerCase() === 'franca' && p.address.state === 'SP'),
      truncated: entities.truncated || positions.length > 1000,
      pins: pins.map((p) => {
        const location = cache.get(mapAddressHash(p.address));
        const point =
          location &&
          ['ready', 'approximate'].includes(location.status) &&
          location.latitude !== null &&
          location.longitude !== null
            ? { latitude: location.latitude, longitude: location.longitude }
            : null;
        return {
          ...p,
          address: addressText(p.address),
          point,
          approximate: location?.status === 'approximate',
          locationStatus: point
            ? 'ready'
            : location?.status === 'unavailable'
              ? 'unavailable'
              : 'pending',
        };
      }),
      couriers: positions.slice(0, 1000).map((p) => {
        const delivery = entities.deliveries.find(
          (d) =>
            d.courierId === p.courierId && ['accepted', 'arrived', 'collected'].includes(d.status),
        );
        return {
          id: p.courierId,
          name: p.courier.name,
          point: { latitude: p.latitude, longitude: p.longitude },
          accuracy: p.accuracy,
          observedAt: p.observedAt.toISOString(),
          availability: p.courier.availabilityStatus,
          deliveryId: delivery?.id ?? null,
          leg: delivery ? (delivery.status === 'collected' ? 'dropoff' : 'pickup') : null,
        };
      }),
    };
  }

  @Post('routes/:id')
  @Roles('admin', 'establishment')
  @Header('Cache-Control', 'no-store')
  async route(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    const entities = await this.entities(r);
    const delivery = entities.deliveries.find((d) => d.id === id);
    if (!delivery) throw new NotFoundException();
    await this.limiter.hit(`map-route:${r.actor.tenantId}:${r.actor.id}`, 12);
    const snapshot = await this.snapshot(r);
    const pickup = snapshot.pins.find((p) => p.id === `pickup:${id}`);
    const dropoff = snapshot.pins.find((p) => p.id === `dropoff:${id}`);
    const courier = snapshot.couriers.find((c) => c.deliveryId === id);
    const target = courier && ['accepted', 'arrived'].includes(delivery.status) ? pickup : dropoff;
    const origin = courier?.point ?? pickup?.point;
    if (!origin || !target?.point)
      throw new BadRequestException('A rota aguarda coordenadas válidas dos endereços.');
    let coordinates = [origin, target.point];
    let kind: 'road' | 'connection' = 'connection';
    let distanceM: number | null = null;
    let notice = 'Ligação aproximada entre os pontos; não representa o trajeto pelas ruas.';
    if (this.ors.enabled) {
      try {
        const route = await this.ors.between(origin, target.point);
        coordinates = route.coordinates;
        distanceM = route.distanceM;
        kind = 'road';
        notice = 'Trajeto calculado pelo openrouteservice.';
      } catch {
        notice = 'Trajeto viário indisponível. Exibindo apenas a ligação entre os pontos.';
      }
    }
    const current = await this.db.delivery.findFirst({
      where: { ...deliveryScope(r.actor), id },
      select: { version: true, status: true },
    });
    if (!current || current.version !== delivery.version || current.status !== delivery.status)
      throw new ConflictException('A entrega mudou. Atualize a rota.');
    return {
      deliveryId: id,
      kind,
      coordinates,
      distanceM,
      notice,
      approximate: !!pickup?.approximate || !!target.approximate,
      origin: courier ? 'GPS recente do entregador' : 'Local de coleta — percurso previsto',
      version: delivery.version,
    };
  }

  @Post('resolve')
  @Roles('admin', 'establishment')
  @Header('Cache-Control', 'no-store')
  async resolve(@Req() r: AuthRequest) {
    await this.limiter.hit(`map-geocode:${r.actor.tenantId}:${r.actor.id}`, 12);
    const pins = this.pins(await this.entities(r));
    const unique = new Map(pins.map((p) => [mapAddressHash(p.address), p.address]));
    const cached = await this.db.mapGeocode.findMany({
      where: {
        tenantId: r.actor.tenantId,
        addressHash: { in: [...unique.keys()] },
        expiresAt: { gt: new Date() },
      },
      select: { addressHash: true },
    });
    for (const c of cached) unique.delete(c.addressHash);
    const results = await Promise.all(
      [...unique.entries()].slice(0, 8).map(async ([addressHash, address]) => {
        const key = { tenantId: r.actor.tenantId, addressHash };
        await this.db.mapGeocode.createMany({
          data: [{ ...key, status: 'pending', expiresAt: new Date(0) }],
          skipDuplicates: true,
        });
        // Lease compartilhada entre instâncias Vercel: evita geocodificar a cada poll/aba.
        const lease = new Date(Date.now() + 60000);
        const claim = await this.db.mapGeocode.updateMany({
          where: { ...key, expiresAt: { lte: new Date() } },
          data: { status: 'pending', latitude: null, longitude: null, expiresAt: lease },
        });
        if (!claim.count) return false;
        let point: { latitude: number; longitude: number } | null = null;
        let approximate = false;
        try {
          if (this.ors.enabled) point = await this.ors.geocode(address);
        } catch {
          /* Falhas ficam explícitas no mapa, sem inventar coordenadas. */
        }
        if (!point && address.city.toLowerCase() === 'franca' && address.state === 'SP') {
          point = (await francaCep(address.postalCode))?.point ?? null;
          approximate = !!point;
        }
        await this.db.mapGeocode.updateMany({
          where: { ...key, expiresAt: lease },
          data: {
            latitude: point?.latitude ?? null,
            longitude: point?.longitude ?? null,
            status: point ? (approximate ? 'approximate' : 'ready') : 'unavailable',
            expiresAt: new Date(Date.now() + (point ? 27 * 86400000 : 300000)),
          },
        });
        return !!point;
      }),
    );
    return { enabled: true, resolved: results.filter(Boolean).length };
  }
}
