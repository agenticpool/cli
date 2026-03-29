import { ApiClient } from '../src/api/ApiClient';
import axios from 'axios';
import { configManager } from '../src/config';

jest.mock('axios');
jest.mock('../src/config');

describe('ApiClient', () => {
  let client: ApiClient;
  let mockAxios: jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockAxios = axios as jest.Mocked<typeof axios>;
    
    const mockInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      defaults: {
        headers: {
          common: {}
        }
      }
    };
    
    mockAxios.create.mockReturnValue(mockInstance as any);
    
    client = new ApiClient('https://test.api.com');
  });

  describe('create', () => {
    it('should create client with config', async () => {
      (configManager.getGlobalConfig as jest.Mock).mockResolvedValue({
        apiUrl: 'https://config.api.com',
        defaultFormat: 'toon'
      });
      
      const newClient = await ApiClient.create();
      
      expect(newClient).toBeDefined();
    });
  });

  describe('setAuthToken', () => {
    it('should set authorization header', () => {
      client.setAuthToken('test-token');
      
      expect(client['client'].defaults.headers.common['Authorization']).toBe('Bearer test-token');
    });
  });

  describe('clearAuthToken', () => {
    it('should remove authorization header', () => {
      client.setAuthToken('test-token');
      client.clearAuthToken();
      
      expect(client['client'].defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('HTTP methods', () => {
    it('should make GET request', async () => {
      const mockGet = client['client'].get as jest.Mock;
      mockGet.mockResolvedValue({ data: { success: true, data: { id: 1 } } });
      
      const result = await client.get('/test');
      
      expect(mockGet).toHaveBeenCalledWith('/test', expect.any(Object));
    });

    it('should make POST request', async () => {
      const mockPost = client['client'].post as jest.Mock;
      mockPost.mockResolvedValue({ data: { success: true, data: { id: 1 } } });
      
      const result = await client.post('/test', { name: 'test' });
      
      expect(mockPost).toHaveBeenCalledWith('/test', expect.any(String), expect.any(Object));
    });

    it('should make PUT request', async () => {
      const mockPut = client['client'].put as jest.Mock;
      mockPut.mockResolvedValue({ data: { success: true } });
      
      const result = await client.put('/test', { name: 'updated' });
      
      expect(mockPut).toHaveBeenCalledWith('/test', expect.any(String), expect.any(Object));
    });

    it('should make DELETE request', async () => {
      const mockDelete = client['client'].delete as jest.Mock;
      mockDelete.mockResolvedValue({ data: { success: true } });
      
      const result = await client.delete('/test');
      
      expect(mockDelete).toHaveBeenCalledWith('/test', expect.any(Object));
    });
  });
});
