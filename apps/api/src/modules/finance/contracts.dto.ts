import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
  IsDefined,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
export class ShiftTemplateDto {
  @ApiProperty() @IsInt() @Min(0) @Max(6) weekday!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1439) startMinute!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1439) endMinute!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(50) courierCount!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(10000) expectedDeliveries!: number;
}
export class ContractTermsDto {
  @ApiProperty() @IsIn(['America/Sao_Paulo']) timezone!: 'America/Sao_Paulo';
  @ApiProperty() @trim() @IsString() @Length(2, 1000) coverage!: string;
  @ApiProperty() @trim() @IsString() @Length(10, 4000) servicePolicy!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(100000000) weeklyAvailabilityCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100000000) platformFeeCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100000) deliveryFeeCents!: number;
  @ApiProperty() @IsIn(['per_delivery', 'fixed', 'fixed_plus_delivery', 'guarantee']) payModel!:
    | 'per_delivery'
    | 'fixed'
    | 'fixed_plus_delivery'
    | 'guarantee';
  @ApiProperty() @IsInt() @Min(0) @Max(10000000) courierFixedCents!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100000) courierDeliveryCents!: number;
  @ApiProperty({ type: [ShiftTemplateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => ShiftTemplateDto)
  templates!: ShiftTemplateDto[];
}
export class VersionDto {
  @ApiProperty() @IsISO8601({ strict: true }) effectiveFrom!: string;
  @ApiProperty() @IsISO8601({ strict: true }) effectiveTo!: string;
  @ApiProperty({ type: ContractTermsDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ContractTermsDto)
  terms!: ContractTermsDto;
}
export class CreateContractDto extends VersionDto {
  @ApiProperty() @IsUUID() establishmentId!: string;
  @ApiProperty() @trim() @IsString() @Length(2, 120) title!: string;
}
export class ReviseContractDto extends VersionDto {
  @ApiProperty() @IsInt() @Min(1) revision!: number;
}
export class RevisionDto {
  @ApiProperty() @IsInt() @Min(1) revision!: number;
}
export class AcceptContractDto extends RevisionDto {
  @ApiProperty() @trim() @IsString() @Length(10, 1000) evidence!: string;
}
export class ScheduleShiftDto {
  @ApiProperty() @IsUUID() versionId!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(20) templateIndex!: number;
  @ApiProperty() @IsISO8601({ strict: true }) startsAt!: string;
}
export class AllocationDto {
  @ApiProperty() @IsUUID() courierId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(50) position!: number;
  @ApiProperty() @IsISO8601({ strict: true }) startsAt!: string;
  @ApiProperty() @IsISO8601({ strict: true }) endsAt!: string;
}
export class ReasonDto {
  @ApiProperty() @trim() @IsString() @Length(10, 1000) reason!: string;
}
export class AttendanceDto extends ReasonDto {
  @ApiProperty() @IsInt() @Min(0) @Max(1440) attendedMinutes!: number;
}

export class ReplacementDto extends ReasonDto {
  @ApiProperty() @IsUUID() courierId!: string;
}
