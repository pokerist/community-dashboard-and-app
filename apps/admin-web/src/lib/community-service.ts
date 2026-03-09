import apiClient from "./api-client";

export type CommunityStructure = "CLUSTERS" | "PHASES";

export type GateRole =
  | "RESIDENT"
  | "VISITOR"
  | "WORKER"
  | "DELIVERY"
  | "STAFF"
  | "RIDESHARE";

export interface CommunityListItem {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  displayOrder: number;
  structureType: CommunityStructure;
  guidelines: string | null;
  _count?: {
    clusters?: number;
    gates?: number;
  };
}

export interface CommunityStats {
  totalUnits: number;
  occupiedUnits: number;
  deliveredUnits: number;
  activeResidents: number;
  openComplaints: number;
}

export interface ClusterItem {
  id: string;
  communityId?: string;
  name: string;
  code: string | null;
  displayOrder: number;
  isActive?: boolean;
  unitCount: number;
}

export interface GateItem {
  id: string;
  communityId: string;
  name: string;
  code: string | null;
  allowedRoles: GateRole[];
  etaMinutes: number | null;
  isActive?: boolean;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  clusterIds?: string[];
}

export interface CommunityDetail {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  structureType: CommunityStructure;
  guidelines: string | null;
  clusters: ClusterItem[];
  gates: GateItem[];
  stats: CommunityStats;
  createdAt: string;
}

export interface CreateCommunityPayload {
  name: string;
  isActive?: boolean;
  structureType?: CommunityStructure;
  guidelines?: string;
}

export interface CreateClusterPayload {
  name: string;
}

export interface CreateGatePayload {
  name: string;
  allowedRoles: GateRole[];
  etaMinutes?: number;
  clusterIds?: string[];
}

const communityService = {
  async listCommunities(): Promise<CommunityListItem[]> {
    const response = await apiClient.get<CommunityListItem[]>("/communities");
    return Array.isArray(response.data) ? response.data : [];
  },

  async createCommunity(payload: CreateCommunityPayload): Promise<CommunityListItem> {
    const response = await apiClient.post<CommunityListItem>("/communities", payload);
    return response.data;
  },

  async updateCommunity(
    id: string,
    payload: Partial<CreateCommunityPayload>,
  ): Promise<CommunityListItem> {
    const response = await apiClient.patch<CommunityListItem>(
      `/communities/${id}`,
      payload,
    );
    return response.data;
  },

  async deleteCommunity(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/communities/${id}`);
    return response.data;
  },

  async getCommunityDetail(id: string): Promise<CommunityDetail> {
    const response = await apiClient.get<CommunityDetail>(`/communities/${id}/detail`);
    return response.data;
  },

  async getCommunityStats(id: string): Promise<CommunityStats> {
    const response = await apiClient.get<CommunityStats>(`/communities/${id}/stats`);
    return response.data;
  },

  async listClusters(communityId: string): Promise<ClusterItem[]> {
    const response = await apiClient.get<ClusterItem[]>(
      `/communities/${communityId}/clusters`,
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async createCluster(
    communityId: string,
    payload: CreateClusterPayload,
  ): Promise<ClusterItem> {
    const response = await apiClient.post<ClusterItem>(
      `/communities/${communityId}/clusters`,
      payload,
    );
    return response.data;
  },

  async updateCluster(
    id: string,
    payload: Partial<CreateClusterPayload>,
  ): Promise<ClusterItem> {
    const response = await apiClient.patch<ClusterItem>(`/clusters/${id}`, payload);
    return response.data;
  },

  async deleteCluster(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/clusters/${id}`);
    return response.data;
  },

  async reorderClusters(communityId: string, orderedIds: string[]) {
    const response = await apiClient.patch<{ success: true }>(
      `/communities/${communityId}/clusters/reorder`,
      { orderedIds },
    );
    return response.data;
  },

  async listGates(communityId: string): Promise<GateItem[]> {
    const response = await apiClient.get<GateItem[]>(
      `/communities/${communityId}/gates`,
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async createGate(
    communityId: string,
    payload: CreateGatePayload,
  ): Promise<GateItem> {
    const response = await apiClient.post<GateItem>(
      `/communities/${communityId}/gates`,
      payload,
    );
    return response.data;
  },

  async updateGate(id: string, payload: Partial<CreateGatePayload>): Promise<GateItem> {
    const response = await apiClient.patch<GateItem>(`/gates/${id}`, payload);
    return response.data;
  },

  async updateGateRoles(id: string, roles: GateRole[]): Promise<GateItem> {
    const response = await apiClient.patch<GateItem>(`/gates/${id}/roles`, { roles });
    return response.data;
  },

  async deleteGate(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/gates/${id}`);
    return response.data;
  },
};

export default communityService;
