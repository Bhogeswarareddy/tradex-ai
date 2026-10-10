export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface HealthStatus {
  status: string;
  version: string;
  environment: string;
  database?: string;
  ai_provider: string;
}

export interface SimulatedMetadata {
  simulated: true;
  notice: string;
}

export interface ApiError {
  detail: string;
  status?: number;
}
