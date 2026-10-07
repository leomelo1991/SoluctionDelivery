import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
const cleanText = () =>
  Transform(({ value, key }) =>
    typeof value === 'string' &&
    !['password', 'currentPassword', 'newPassword', 'temporaryPassword'].includes(key)
      ? value.trim()
      : value,
  );
export class AddressDto {
  @ApiProperty() @cleanText() @IsString() @Length(2, 160) street!: string;
  @ApiProperty() @cleanText() @IsString() @Length(1, 20) number!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 100) district!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 100) city!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 2) state!: string;
  @ApiProperty() @cleanText() @IsString() @Length(8, 9) postalCode!: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(0, 120)
  complement?: string;
}
export class LoginDto {
  @ApiProperty() @cleanText() @IsString() @Length(2, 80) tenant!: string;
  @ApiProperty() @cleanText() @IsEmail() email!: string;
  @ApiProperty() @cleanText() @IsString() @Length(1, 128) password!: string;
}
export class PasswordDto {
  @ApiProperty() @cleanText() @IsString() @Length(1, 128) currentPassword!: string;
  @ApiProperty() @cleanText() @IsString() @Length(12, 128) newPassword!: string;
}
export class EstablishmentDto {
  @ApiProperty() @cleanText() @IsString() @Length(2, 120) name!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 120) responsible!: string;
  @ApiProperty() @cleanText() @IsString() @Length(8, 25) phone!: string;
  @ApiProperty() @cleanText() @IsEmail() email!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 100) city!: string;
  @ApiProperty({ type: AddressDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(1, 80)
  acquisitionChannel?: string;
}
export class EstablishmentPatchDto {
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['lead', 'onboarding', 'active', 'paused'])
  lifecycleStatus?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  operationOpen?: boolean;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(2, 120)
  name?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(2, 120)
  responsible?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(8, 25)
  phone?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsEmail()
  email?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(2, 100)
  city?: string;
  @ApiPropertyOptional({ type: AddressDto })
  @ValidateIf((_o, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(1, 80)
  acquisitionChannel?: string;
}
export class CourierDto {
  @ApiProperty() @cleanText() @IsString() @Length(2, 120) name!: string;
  @ApiProperty() @cleanText() @IsString() @Length(8, 25) phone!: string;
  @ApiProperty() @IsIn(['motorcycle', 'bicycle', 'car']) vehicle!: string;
}
export class ApprovalDto {
  @ApiProperty() @IsIn(['approved', 'paused']) status!: string;
}
export class AvailabilityDto {
  @ApiProperty() @IsIn(['available', 'offline']) status!: string;
}
export class NoteDto {
  @ApiProperty() @cleanText() @IsString() @Length(1, 4000) text!: string;
}
export class UserDto {
  @ApiProperty() @cleanText() @IsString() @Length(2, 120) name!: string;
  @ApiProperty() @cleanText() @IsEmail() email!: string;
  @ApiProperty() @cleanText() @IsString() @Length(12, 128) temporaryPassword!: string;
  @ApiProperty() @IsIn(['admin', 'establishment', 'courier']) role!:
    | 'admin'
    | 'establishment'
    | 'courier';
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsUUID()
  establishmentId?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsUUID()
  courierId?: string;
}
export class UserActionDto {
  @ApiProperty() @IsBoolean() active!: boolean;
}
export class ResetPasswordDto {
  @ApiProperty() @cleanText() @IsString() @Length(12, 128) temporaryPassword!: string;
}
export class QuoteDto {
  @ApiProperty() @IsUUID() establishmentId!: string;
  @ApiProperty({ type: AddressDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  destinationAddress!: AddressDto;
  @ApiProperty() @IsIn(['distance', 'region']) method!: 'distance' | 'region';
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsUUID()
  regionId?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2000000)
  manualDistanceM?: number;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(5, 500)
  manualReason?: string;
}
export class CreateDeliveryDto extends QuoteDto {
  @ApiProperty() @IsUUID() quoteId!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 120) recipientName!: string;
  @ApiProperty() @cleanText() @IsString() @Length(8, 25) recipientPhone!: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(0, 2000)
  notes?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  pickupReady?: boolean;
}
export class DeliveryActionDto {
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsUUID()
  courierId?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(5, 500)
  reason?: string;
}
export class FormulaDto {
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) baseCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(2000000) includedMeters!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) perKmCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) minimumCents!: number;
}
export class PricingDto {
  @ApiProperty({ type: FormulaDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => FormulaDto)
  fee!: FormulaDto;
  @ApiProperty({ type: FormulaDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => FormulaDto)
  payout!: FormulaDto;
}
export class RegionDto {
  @ApiProperty() @cleanText() @IsString() @Length(2, 100) name!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 100) city!: string;
  @ApiProperty() @cleanText() @IsString() @Length(2, 1000) coverage!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) feeCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) payoutCents!: number;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
export class SurchargeDto {
  @ApiProperty() @cleanText() @IsString() @Length(2, 100) name!: string;
  @ApiProperty() @cleanText() @IsString() @Length(5, 500) reason!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) feeFixedCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100000) feePercentBps!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) payoutFixedCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100000) payoutPercentBps!: number;
  @ApiProperty() @IsISO8601({ strict: true }) startsAt!: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsISO8601({ strict: true })
  endsAt?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
export class RoutingDto {
  @ApiProperty() @IsIn(['mapbox', 'google']) primary!: string;
  @ApiProperty() @IsBoolean() fallback!: boolean;
}
export class ListDto {
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 30;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @cleanText()
  @IsString()
  @Length(0, 100)
  q?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['waiting', 'assigned', 'accepted', 'arrived', 'collected', 'delivered', 'active'])
  status?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['lead', 'onboarding', 'active', 'paused'])
  lifecycleStatus?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['pending', 'approved', 'paused'])
  approvalStatus?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['true', 'false'])
  operationOpen?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['offline', 'available', 'busy'])
  availabilityStatus?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsISO8601({ strict: true })
  from?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsISO8601({ strict: true })
  to?: string;
}

export class NavigationDto {
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude!: number;
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude!: number;
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiProperty() @IsInt() @Min(1) timestamp!: number;
}
