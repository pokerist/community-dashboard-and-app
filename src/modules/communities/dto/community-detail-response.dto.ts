import { EntryRole, GateRole } from '@prisma/client';
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
}

export class CommunityDetailResponseDto {
  id!: string;
  name!: string;
  code!: string | null;
  isActive!: boolean;
  allowedEntryRoles!: EntryRole[];
  clusters!: ClusterItem[];
  gates!: GateItem[];
  stats!: CommunityStatsResponseDto;
  createdAt!: string;
}

