import apiClient from "./api-client";

export interface NewsItem {
  id: string;
  caption: string;
  imageFileId: string | null;
  imageUrl: string | null;
  authorId: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  communityId: string | null;
  communityName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  communityId?: string;
}

export interface PaginatedNews {
  data: NewsItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateNewsPayload {
  caption: string;
  imageFileId?: string | null;
  communityId?: string;
}

const newsService = {
  async list(query: NewsListQuery): Promise<PaginatedNews> {
    const res = await apiClient.get<PaginatedNews>("/news", { params: query });
    return res.data;
  },

  async get(id: string): Promise<NewsItem> {
    const res = await apiClient.get<NewsItem>(`/news/${id}`);
    return res.data;
  },

  async create(payload: CreateNewsPayload): Promise<NewsItem> {
    const res = await apiClient.post<NewsItem>("/news", payload);
    return res.data;
  },

  async update(id: string, payload: Partial<CreateNewsPayload>): Promise<NewsItem> {
    const res = await apiClient.patch<NewsItem>(`/news/${id}`, payload);
    return res.data;
  },

  async remove(id: string): Promise<{ success: true }> {
    const res = await apiClient.delete<{ success: true }>(`/news/${id}`);
    return res.data;
  },
};

export default newsService;
