import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { configManager, GlobalConfig } from '../config';
import chalk from 'chalk';

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
    console.log(chalk.gray(`[DEBUG] Initializing ApiClient with baseUrl: ${baseUrl}`));
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(config => {
      console.log(chalk.gray(`[DEBUG] API Request: ${config.method?.toUpperCase()} ${config.url}`));
      if (config.params) console.log(chalk.gray(`[DEBUG] Params: ${JSON.stringify(config.params)}`));
      return config;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        console.log(chalk.gray(`[DEBUG] API Response: ${response.status} ${response.config.url}`));
        return response;
      },
      error => {
        console.log(chalk.red(`[DEBUG] API Error: ${error.message}`));
        if (error.response) {
          console.log(chalk.red(`[DEBUG] Status: ${error.response.status}`));
          console.log(chalk.red(`[DEBUG] Data: ${JSON.stringify(error.response.data)}`));
        }
        return Promise.reject(error);
      }
    );
  }

  static async create(): Promise<ApiClient> {
    console.log(chalk.gray('[DEBUG] ApiClient.create() called'));
    const config = await configManager.getGlobalConfig();
    const client = new ApiClient(config.apiUrl);
    client.format = config.defaultFormat;
    return client;
  }

  setAuthToken(token: string): void {
    console.log(chalk.gray('[DEBUG] Setting Auth Token'));
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    console.log(chalk.gray('[DEBUG] Clearing Auth Token'));
    delete this.client.defaults.headers.common['Authorization'];
  }

  setFormat(format: 'toon' | 'json'): void {
    console.log(chalk.gray(`[DEBUG] Setting format to: ${format}`));
    this.format = format;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = { params: { ...params, format: this.format } };
    try {
      const response = await this.client.get(path, config);
      return this.parseResponse<T>(response.data);
    } catch (e) {
      return { success: false, error: { code: 'REQUEST_FAILED', message: e instanceof Error ? e.message : 'Unknown error' } };
    }
  }

  async post<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const body = this.format === 'toon' && data ? encode(data) : JSON.stringify(data);
    const config: AxiosRequestConfig = { 
      params: { format: this.format },
      headers: { 'Content-Type': 'text/plain' }
    };
    try {
      const response = await this.client.post(path, body, config);
      return this.parseResponse<T>(response.data);
    } catch (e) {
      return { success: false, error: { code: 'REQUEST_FAILED', message: e instanceof Error ? e.message : 'Unknown error' } };
    }
  }

  async put<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const body = this.format === 'toon' && data ? encode(data) : JSON.stringify(data);
    const config: AxiosRequestConfig = { 
      params: { format: this.format },
      headers: { 'Content-Type': 'text/plain' }
    };
    try {
      const response = await this.client.put(path, body, config);
      return this.parseResponse<T>(response.data);
    } catch (e) {
      return { success: false, error: { code: 'REQUEST_FAILED', message: e instanceof Error ? e.message : 'Unknown error' } };
    }
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = { params: { format: this.format } };
    try {
      const response = await this.client.delete(path, config);
      return this.parseResponse<T>(response.data);
    } catch (e) {
      return { success: false, error: { code: 'REQUEST_FAILED', message: e instanceof Error ? e.message : 'Unknown error' } };
    }
  }

  private parseResponse<T>(data: string | object): ApiResponse<T> {
    console.log(chalk.gray(`[DEBUG] Parsing response data (type: ${typeof data})`));
    if (typeof data === 'string') {
      try {
        return decode<ApiResponse<T>>(data);
      } catch (err) {
        console.log(chalk.red(`[DEBUG] Parse Error: ${err instanceof Error ? err.message : 'Unknown'}`));
        return { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse response' } };
      }
    }
    return data as ApiResponse<T>;
  }
}
