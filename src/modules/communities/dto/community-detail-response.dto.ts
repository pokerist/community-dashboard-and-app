import { CommunityStructure, GateRole } from '@prisma/client';
import { CommunityStatsResponseDto } from './community-stats-response.dto';

export interface ClusterItem {
  id: string;
  name: string;
  code: string | null;
  displayOrder: number;
  unitCount: number;
}

export interface GateItem {
  id: string;
  name: string;
  code: string | null;
  allowedRoles: GateRole[];
  etaMinutes: number | null;
  isActive: boolean;
  clusterIds: string[];
}

export class CommunityDetailResponseDto {
  id!: string;
  name!: string;
  code!: string | null;
  isActive!: boolean;
  structureType!: CommunityStructure;
  guidelines!: string | null;
  clusters!: ClusterItem[];
  gates!: GateItem[];
  stats!: CommunityStatsResponseDto;
  createdAt!: string;
}

