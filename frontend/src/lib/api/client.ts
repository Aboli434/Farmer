import { env } from '@/config/env';
import { ApiResponse } from '@/types/auth';

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * Helper to build the headers for a request.
 */
function buildHeaders(options: RequestOptions): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  return headers;
}

/**
 * Core API Client function.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${env.API_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options),
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      // Throw an error that carries the exact backend format
      const error: ApiResponse = data;
      throw new ApiClientError(
        error.error?.message || response.statusText,
        response.status,
        error.error?.code,
        error.error?.details
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    // Network or parsing errors
    throw new ApiClientError(
      error instanceof Error ? error.message : 'Unknown network error',
      500,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Custom Error class that matches the backend's ApiError structure
 */
export class ApiClientError extends Error {
  constructor(
    public message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
