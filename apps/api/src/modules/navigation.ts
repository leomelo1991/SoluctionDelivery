import {
  BadRequestException,
  Body,
  ConflictException,
  ForbiddenException,
  Controller,
  Header,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Database } from '../database.js';
import { NavigationDto, type AddressDto } from '../http/dto.js';
import { Roles, type Actor, type AuthRequest } from '../http/security.js';
import { deliveryScope } from './deliveries.js';
import { GoogleProvider } from './routing.js';
export type NavigationRoute = Awaited<ReturnType<GoogleProvider['navigate']>> & {
  deliveryId: string;
  version: number;
  leg: 'pickup' | 'dropoff';
};
@Injectable()
export class NavigationService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(GoogleProvider) private google: GoogleProvider,
  ) {}
  async route(actor: Actor, id: string, input: NavigationDto): Promise<NavigationRoute> {
    if (actor.role !== 'courier' || !actor.courierId) throw new ForbiddenException();
    // The caller supplies only their origin. The server selects the authorized destination.
    const where = { ...deliveryScope(actor), id };
    const delivery = await this.db.delivery.findFirst({ where });
    if (!delivery) throw new NotFoundException();
    const leg =
      delivery.status === 'collected'
        ? 'dropoff'
        : ['accepted', 'arrived'].includes(delivery.status)
          ? 'pickup'
          : null;
    if (!leg || delivery.version !== input.version)
      throw new ConflictException({
        code: 'STALE_VERSION',
        message: 'A etapa da entrega mudou. Atualize a entrega.',
      });
    if (Date.now() - input.timestamp > 30000 || input.timestamp > Date.now() + 5000)
      throw new BadRequestException({
        code: 'LOCATION_STALE',
        message: 'Aguarde uma localização atual do aparelho.',
      });
    if (!this.google.enabled)
      throw new ServiceUnavailableException({
        code: 'NAVIGATION_NOT_CONFIGURED',
        message:
          'A rota no mapa está indisponível. Use Abrir navegação para seguir até o endereço.',
      });
    let result;
    try {
      result = await this.google.navigate(
        { latitude: input.latitude, longitude: input.longitude },
        (leg === 'pickup'
          ? delivery.pickupAddress
          : delivery.destinationAddress) as unknown as AddressDto,
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'NAVIGATION_UNAVAILABLE',
        message: 'Não foi possível calcular o trajeto. Tente novamente ou abra a navegação.',
      });
    }
    // Discard a result if collection/completion happened while the provider was responding.
    const current = await this.db.delivery.findFirst({
      where,
      select: { version: true, status: true },
    });
    if (!current || current.version !== delivery.version || current.status !== delivery.status)
      throw new ConflictException({
        code: 'STALE_VERSION',
        message: 'A etapa da entrega mudou. Atualize a entrega.',
      });
    return { ...result, deliveryId: id, version: delivery.version, leg };
  }
}
@ApiTags('Navegação do entregador')
@Controller('deliveries')
export class NavigationController {
  constructor(@Inject(NavigationService) private navigation: NavigationService) {}
  @Post(':id/navigation')
  @Roles('courier')
  @Header('Cache-Control', 'no-store')
  route(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: NavigationDto,
  ) {
    return this.navigation.route(request.actor, id, input);
  }
}
