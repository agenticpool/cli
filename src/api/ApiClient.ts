import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { configManager, GlobalConfig } from '../config';
import { logger } from '../utils/logger';
import { encode, decode } from '../datamodel';

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

export class ApiClient {
  private client: AxiosInstance;
  private format: 'toon' | 'json' = 'toon';

  constructor(baseUrl: string) {
    logger.debug(`Initializing ApiClient with baseUrl: ${baseUrl}`);
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(config => {
      logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      if (config.params) logger.debug(`Params: ${JSON.stringify(config.params)}`);
      return config;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      error => {
        logger.debug(`API Error: ${error.message}`);
        if (error.response) {
          logger.debug(`Status: ${error.response.status}`);
          logger.debug(`Data: ${JSON.stringify(error.response.data)}`);
        }
        return Promise.reject(error);
      }
    );
  }

  static async create(): Promise<ApiClient> {
    logger.debug('ApiClient.create() called');
    const config = await configManager.getGlobalConfig();
    const client = new ApiClient(config.apiUrl);
    client.format = config.defaultFormat;
    return client;
  }

  setAuthToken(token: string): void {
    logger.debug('Setting Auth Token');
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    logger.debug('Clearing Auth Token');
    delete this.client.defaults.headers.common['Authorization'];
  }

  setFormat(format: 'toon' | 'json'): void {
    logger.debug(`Setting format to: ${format}`);
    this.format = format;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = { params: { ...params, format: this.format } };
    try {
      const response = await this.client.get(path, config);
      return this.parseResponse<T>(response.data);
    } catch (e: any) {
      if (e.response && e.response.data) {
        return this.parseResponse<T>(e.response.data);
      }
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
    } catch (e: any) {
      if (e.response && e.response.data) {
        return this.parseResponse<T>(e.response.data);
      }
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
    } catch (e: any) {
      if (e.response && e.response.data) {
        return this.parseResponse<T>(e.response.data);
      }
      return { success: false, error: { code: 'REQUEST_FAILED', message: e instanceof Error ? e.message : 'Unknown error' } };
    }
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = { params: { format: this.format } };
    try {
      const response = await this.client.delete(path, config);
      return this.parseResponse<T>(response.data);
    } catch (e: any) {
      if (e.response && e.response.data) {
        return this.parseResponse<T>(e.response.data);
      }
      return { success: false, error: { code: 'REQUEST_FAILED', message: e instanceof Error ? e.message : 'Unknown error' } };
    }
  }

  private parseResponse<T>(data: string | object): ApiResponse<T> {
    logger.debug(`Parsing response data (type: ${typeof data})`);
    if (typeof data !== 'string') {
      return data as ApiResponse<T>;
    }

    const trimmed = data.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed) as ApiResponse<T>;
      } catch {
        return { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse JSON response' } };
      }
    }

    if (trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE')) {
      return { success: false, error: { code: 'PARSE_ERROR', message: 'Received HTML instead of API response' } };
    }

    try {
      return decode<ApiResponse<T>>(trimmed);
    } catch {
      try {
        return JSON.parse(trimmed) as ApiResponse<T>;
      } catch {
        return { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse response' } };
      }
    }
  }

  async reportError(errorContext: {
    command: string;
    errorCode: string;
    errorMessage: string;
    stackTrace?: string;
    cliVersion: string;
    nodeVersion: string;
    os: string;
    arch: string;
    agentModel?: string;
    agentName?: string;
    tags?: string[];
  }): Promise<void> {
    try {
      const savedFormat = this.format;
      this.format = 'json';
      await this.post('/v1/errors', errorContext);
      this.format = savedFormat;
    } catch {
      // Silent — never block CLI for error reporting
    }
  }
}
