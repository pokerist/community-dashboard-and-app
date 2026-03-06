import { EligibilityType, ServiceCategory, ServiceFieldType } from '@prisma/client';

export class ServiceFieldResponseDto {
  id!: string;
  label!: string;
  type!: ServiceFieldType;
  placeholder!: string | null;
  required!: boolean;
  order!: number;
}

export class ServiceListItemDto {
  id!: string;
  name!: string;
  category!: ServiceCategory;
  status!: boolean;
  description!: string | null;
  slaHours!: number | null;
  startingPrice!: number | null;
  assignedRoleName!: string | null;
  totalRequestsCount!: number;
  revenueTotal!: number;
  iconName!: string | null;
  iconTone!: string;
  isUrgent!: boolean;
}

export class ServiceDetailStatsDto {
  totalRequests!: number;
  openRequests!: number;
  resolvedThisMonth!: number;
  avgResolutionHours!: number;
  slaBreachRate!: number;
  revenueTotal!: number;
}

export class ServiceDetailResponseDto {
  id!: string;
  name!: string;
  category!: ServiceCategory;
  status!: boolean;
  unitEligibility!: EligibilityType;
  processingTime!: number | null;
  description!: string | null;
  slaHours!: number | null;
  startingPrice!: number | null;
  assignedRoleId!: string | null;
  assignedRoleName!: string | null;
  isUrgent!: boolean;
  iconName!: string | null;
  iconTone!: string;
  fields!: ServiceFieldResponseDto[];
  stats!: ServiceDetailStatsDto;
  createdAt!: string;
  updatedAt!: string;
}

export class ServiceStatsResponseDto {
  totalServices!: number;
  activeServices!: number;
  totalRequests!: number;
  openRequests!: number;
  slaBreachedRequests!: number;
  resolvedThisMonth!: number;
  totalRevenue!: number;
  requestsByCategory!: Record<ServiceCategory, number>;
}

