import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, IsUUID, Length, Matches, ValidateIf } from 'class-validator';
export class FinanceReasonDto {
  @ApiPropertyOptional() @IsString() @Length(0, 500) reason = '';
}
export class WalletDto extends FinanceReasonDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
}
export class PermissionDto extends WalletDto {
  @ApiProperty() @IsUUID() userId!: string;
}
export class FinanceQuery {
  @ApiPropertyOptional() @ValidateIf((_o, v) => v !== undefined) @IsUUID() establishmentId?: string;
  @ApiPropertyOptional() @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
}
export class TopupDto extends FinanceReasonDto {
  @ApiProperty() @IsUUID() establishmentId!: string;
  @ApiProperty({ description: 'Centavos em string decimal, sem casas decimais.' })
  @IsString()
  @Matches(/^[1-9][0-9]{0,11}$/)
  amountCents!: string;
  @ApiProperty() @IsString() @Matches(/^[A-Za-z0-9_-]{8,80}$/) reference!: string;
  @ApiProperty({ enum: ['approve', 'decline', 'timeout_after_accept'] })
  @IsIn(['approve', 'decline', 'timeout_after_accept'])
  scenario!: string;
}
export class WeekReservationDto {
  @ApiProperty() @IsUUID() versionId!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) week!: string;
}
export class DeliveryReservationDto {
  @ApiProperty() @IsUUID() deliveryId!: string;
}
export class CloseReservationDto extends FinanceReasonDto {
  @ApiProperty() @IsString() @Matches(/^(0|[1-9][0-9]{0,11})$/) consumedCents!: string;
}
