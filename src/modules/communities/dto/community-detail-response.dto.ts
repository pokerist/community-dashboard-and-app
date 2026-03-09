import { GateRole } from '@prisma/client';
import { CommunityStatsResponseDto } from './community-stats-response.dto';

export interface PhaseItem {
  id: string;
  name: string;
  code: string | null;
  displayOrder: number;
  unitCount: number;
  clusterCount: number;
}

export interface ClusterItem {
  id: string;
  phaseId: string;
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
  phaseIds: string[];
  clusterIds: string[];
}

export class CommunityDetailResponseDto {
  id!: string;
  name!: string;
  code!: string | null;
  isActive!: boolean;
  guidelines!: string | null;
  phases!: PhaseItem[];
  clusters!: ClusterItem[];
  gates!: GateItem[];
  stats!: CommunityStatsResponseDto;
  createdAt!: string;
}

