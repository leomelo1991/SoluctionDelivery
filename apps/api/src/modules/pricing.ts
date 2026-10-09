import { config } from '../config.js';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Database } from '../database.js';
import { Prisma } from '../generated/prisma/client.js';
import { Roles, type Actor, type AuthRequest } from '../http/security.js';
import {
  PricingDto,
  QuoteDto,
  RegionDto,
  RoutingDto,
  SurchargeDto,
  type AddressDto,
} from '../http/dto.js';
import { distancePrice, withSurcharges, type Formula } from '../domain/pricing.js';
import { atomic, audit, inputHash, json } from './transactions.js';
import { RoutingService } from './routing.js';
export function quoteInput(b: QuoteDto) {
  return {
    establishmentId: b.establishmentId,
    destinationAddress: b.destinationAddress,
    method: b.method,
    regionId: b.regionId ?? null,
    manualDistanceM: b.manualDistanceM ?? null,
    manualReason: b.manualReason ?? null,
  };
}
export async function pricingState(
  tx: Prisma.TransactionClient,
  tenantId: string,
  regionId?: string,
) {
  const now = new Date();
  const config = await tx.pricingConfig.findUnique({ where: { tenantId } });
  const region = regionId
    ? await tx.region.findUnique({ where: { tenantId_id: { tenantId, id: regionId } } })
    : null;
  const surcharges = await tx.surcharge.findMany({
    where: {
      tenantId,
      active: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { id: 'asc' },
  });
  return { config, region, surcharges, fingerprint: inputHash({ config, region, surcharges }) };
}
@Injectable()
export class PricingService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(RoutingService) private routing: RoutingService,
  ) {}
  async quote(a: Actor, b: QuoteDto) {
    if (a.role === 'establishment' && a.establishmentId !== b.establishmentId)
      throw new ForbiddenException();
    const store = await this.db.establishment.findUniqueOrThrow({
      where: { tenantId_id: { tenantId: a.tenantId, id: b.establishmentId } },
    });
    if (store.lifecycleStatus !== 'active' || !store.operationOpen)
      throw new BadRequestException({
        code: 'OPERATION_CLOSED',
        message: 'O estabelecimento precisa estar ativo e com a operação aberta.',
      });
    if (b.method === 'region' && !b.regionId)
      throw new BadRequestException({ code: 'REGION_REQUIRED', message: 'Selecione uma região.' });
    if (b.method === 'distance' && b.regionId)
      throw new BadRequestException({
        code: 'INVALID_QUOTE',
        message: 'Não informe região na modalidade por distância.',
      });
    if (b.manualDistanceM !== undefined && b.method !== 'distance')
      throw new BadRequestException({
        code: 'INVALID_QUOTE',
        message: 'Distância manual exige modalidade por distância.',
      });
    const route =
      b.method === 'distance'
        ? b.manualDistanceM !== undefined
          ? { distanceM: b.manualDistanceM, provider: 'manual', durationSeconds: null }
          : await this.routing.route(
              a.tenantId,
              store.address as unknown as AddressDto,
              b.destinationAddress,
            )
        : null;
    return atomic(this.db, async (tx) => {
      const { config, region, surcharges, fingerprint } = await pricingState(
        tx,
        a.tenantId,
        b.regionId,
      );
      if (b.method === 'distance' && !config)
        throw new BadRequestException({
          code: 'PRICING_NOT_CONFIGURED',
          message: 'O administrador precisa configurar a fórmula por distância.',
        });
      if (
        b.method === 'region' &&
        (!region?.active ||
          region.city.toLocaleLowerCase('pt-BR') !==
            b.destinationAddress.city.toLocaleLowerCase('pt-BR'))
      )
        throw new BadRequestException({
          code: 'REGION_INVALID',
          message: 'Selecione uma região ativa da cidade de destino.',
        });
      const baseFee =
        b.method === 'region'
          ? region!.feeCents
          : distancePrice(route!.distanceM, config!.fee as unknown as Formula);
      const basePayout =
        b.method === 'region'
          ? region!.payoutCents
          : distancePrice(route!.distanceM, config!.payout as unknown as Formula);
      const feeCents = withSurcharges(
        baseFee,
        surcharges.map((s) => ({ fixedCents: s.feeFixedCents, percentBps: s.feePercentBps })),
      );
      const payoutCents = withSurcharges(
        basePayout,
        surcharges.map((s) => ({ fixedCents: s.payoutFixedCents, percentBps: s.payoutPercentBps })),
      );
      const snapshot = {
        method: b.method,
        regionId: b.regionId ?? null,
        regionName: region?.name ?? null,
        formulaVersion: config?.version ?? null,
        feeFormula: b.method === 'distance' ? config?.fee : null,
        payoutFormula: b.method === 'distance' ? config?.payout : null,
        baseFeeCents: baseFee,
        basePayoutCents: basePayout,
        feeCents,
        payoutCents,
        surcharges: surcharges.map((s) => ({
          id: s.id,
          name: s.name,
          reason: s.reason,
          version: s.version,
          feeFixedCents: s.feeFixedCents,
          feePercentBps: s.feePercentBps,
          payoutFixedCents: s.payoutFixedCents,
          payoutPercentBps: s.payoutPercentBps,
        })),
        provider: route?.provider ?? null,
        manualDistanceM: b.manualDistanceM ?? null,
        manualReason: b.manualReason ?? null,
        fingerprint,
        pickupHash: inputHash(store.address),
      };
      const quote = await tx.quote.create({
        data: {
          tenantId: a.tenantId,
          userId: a.id,
          establishmentId: store.id,
          inputHash: inputHash(quoteInput(b)),
          snapshot: json(snapshot),
          feeCents,
          payoutCents,
          expiresAt: new Date(Date.now() + 300000),
        },
      });
      if (b.manualDistanceM !== undefined)
        await audit(
          tx,
          a,
          'quote',
          quote.id,
          'manual_distance',
          { distanceM: b.manualDistanceM },
          b.manualReason,
        );
      return {
        id: quote.id,
        expiresAt: quote.expiresAt,
        feeCents,
        payoutCents,
        snapshot,
        distanceM: route?.distanceM ?? null,
        durationSeconds: route?.durationSeconds ?? null,
        provider: route?.provider ?? null,
      };
    });
  }
}
@ApiTags('Precificação')
@Controller('pricing')
export class PricingController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(PricingService) private pricing: PricingService,
  ) {}
  @Get() @Roles('admin', 'establishment') async settings(@Req() r: AuthRequest) {
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: r.actor.tenantId } });
    return {
      formula: await this.db.pricingConfig.findUnique({ where: { tenantId: r.actor.tenantId } }),
      regions: await this.db.region.findMany({
        where: { tenantId: r.actor.tenantId },
        orderBy: { name: 'asc' },
      }),
      surcharges: await this.db.surcharge.findMany({
        where: { tenantId: r.actor.tenantId },
        orderBy: { startsAt: 'desc' },
      }),
      routing: {
        primary:
          config.ROUTING_PROVIDER === 'openrouteservice'
            ? 'openrouteservice'
            : tenant.routingPrimary,
        fallback: config.ROUTING_PROVIDER === 'openrouteservice' ? false : tenant.routingFallback,
      },
    };
  }
  @Post('quotes') @Roles('admin', 'establishment') quote(
    @Req() r: AuthRequest,
    @Body() b: QuoteDto,
  ) {
    return this.pricing.quote(r.actor, b);
  }
  @Patch('formula') @Roles('admin') formula(@Req() r: AuthRequest, @Body() b: PricingDto) {
    return atomic(this.db, async (tx) => {
      const p = await tx.pricingConfig.upsert({
        where: { tenantId: r.actor.tenantId },
        create: { tenantId: r.actor.tenantId, fee: json(b.fee), payout: json(b.payout) },
        update: { fee: json(b.fee), payout: json(b.payout), version: { increment: 1 } },
      });
      await audit(tx, r.actor, 'pricing', r.actor.tenantId, 'formula_updated', p);
      return p;
    });
  }
  @Post('regions') @Roles('admin') region(@Req() r: AuthRequest, @Body() b: RegionDto) {
    return atomic(this.db, async (tx) => {
      const x = await tx.region.create({ data: { ...b, tenantId: r.actor.tenantId } });
      await audit(tx, r.actor, 'region', x.id, 'created', x);
      return x;
    });
  }
  @Patch('regions/:id') @Roles('admin') updateRegion(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RegionDto,
  ) {
    return atomic(this.db, async (tx) => {
      const x = await tx.region.update({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        data: { ...b, version: { increment: 1 } },
      });
      await audit(tx, r.actor, 'region', id, 'updated', x);
      return x;
    });
  }
  @Post('surcharges') @Roles('admin') surcharge(@Req() r: AuthRequest, @Body() b: SurchargeDto) {
    if (b.endsAt && new Date(b.endsAt) <= new Date(b.startsAt))
      throw new BadRequestException('Fim deve ser posterior ao início.');
    return atomic(this.db, async (tx) => {
      const x = await tx.surcharge.create({ data: { ...b, tenantId: r.actor.tenantId } });
      await audit(tx, r.actor, 'surcharge', x.id, 'created', x, b.reason);
      return x;
    });
  }
  @Patch('surcharges/:id') @Roles('admin') updateSurcharge(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: SurchargeDto,
  ) {
    if (b.endsAt && new Date(b.endsAt) <= new Date(b.startsAt))
      throw new BadRequestException('Fim deve ser posterior ao início.');
    return atomic(this.db, async (tx) => {
      const x = await tx.surcharge.update({
        where: { tenantId_id: { tenantId: r.actor.tenantId, id } },
        data: { ...b, endsAt: b.endsAt ?? null, version: { increment: 1 } },
      });
      await audit(tx, r.actor, 'surcharge', id, 'updated', x, b.reason);
      return x;
    });
  }
  @Patch('routing') @Roles('admin') routing(@Req() r: AuthRequest, @Body() b: RoutingDto) {
    return atomic(this.db, async (tx) => {
      await tx.tenant.update({
        where: { id: r.actor.tenantId },
        data: { routingPrimary: b.primary, routingFallback: b.fallback },
      });
      await audit(tx, r.actor, 'tenant', r.actor.tenantId, 'routing_updated', b);
      return { ok: true };
    });
  }
}
