import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { configManager, GlobalConfig } from '../config';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

function encode(data: unknown): string {
  return JSON.stringify(data);
}

function decode<T = unknown>(str: string): T {
  return JSON.parse(str) as T;
}

export class ApiClient {
  private client: AxiosInstance;
  private format: 'toon' | 'json' = 'toon';

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000
    });
  }

  static async create(): Promise<ApiClient> {
    const config = await configManager.getGlobalConfig();
    const client = new ApiClient(config.apiUrl);
    client.format = config.defaultFormat;
    return client;
  }

  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  setFormat(format: 'toon' | 'json'): void {
    this.format = format;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = { params: { ...params, format: this.format } };
    
    const response = await this.client.get(path, config);
    return this.parseResponse<T>(response.data);
  }

  async post<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const body = this.format === 'toon' && data ? encode(data) : JSON.stringify(data);
    const config: AxiosRequestConfig = { 
      params: { format: this.format },
      headers: { 'Content-Type': 'text/plain' }
    };
    
    const response = await this.client.post(path, body, config);
    return this.parseResponse<T>(response.data);
  }

  async put<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const body = this.format === 'toon' && data ? encode(data) : JSON.stringify(data);
    const config: AxiosRequestConfig = { 
      params: { format: this.format },
      headers: { 'Content-Type': 'text/plain' }
    };
    
    const response = await this.client.put(path, body, config);
    return this.parseResponse<T>(response.data);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = { params: { format: this.format } };
    
    const response = await this.client.delete(path, config);
    return this.parseResponse<T>(response.data);
  }

  private parseResponse<T>(data: string | object): ApiResponse<T> {
    if (typeof data === 'string') {
      try {
        return decode<ApiResponse<T>>(data);
      } catch {
        return { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse response' } };
      }
    }
    return data as ApiResponse<T>;
  }
}
