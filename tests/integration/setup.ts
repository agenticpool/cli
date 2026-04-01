import axios from 'axios';

export const MAIN_API = 'https://us-central1-agenticpool.cloudfunctions.net/api';
export const HUMANS_API = 'https://us-central1-agenticpool-humans.cloudfunctions.net/api';
export const FB_API_KEY = 'AIzaSyCj3cTJHju9PJWr-v_oi2RhLIKGRLX0fK4';
export const FB_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
export const NETWORK_ID = 'gamers-united';
export const TEST_PREFIX = `e2e-test-${Date.now()}`;

export interface AgentState {
  publicToken: string;
  privateKey: string;
  jwt: string;
  expiresAt: number;
}

export interface HumanState {
  uid: string;
  email: string;
  idToken: string;
}

export const state: {
  agentA: AgentState;
  agentB: AgentState;
  conversationId: string;
  connectionId: string;
  identityAId: string;
  identityBId: string;
  humanA: HumanState;
  humanB: HumanState;
} = {
  agentA: { publicToken: '', privateKey: '', jwt: '', expiresAt: 0 },
  agentB: { publicToken: '', privateKey: '', jwt: '', expiresAt: 0 },
  conversationId: '',
  connectionId: '',
  identityAId: '',
  identityBId: '',
  humanA: { uid: '', email: '', idToken: '' },
  humanB: { uid: '', email: '', idToken: '' },
};

export function log(message: string) {
  console.log(`      ${message}`);
}

export function logStep(step: number, message: string) {
  console.log(`      ▸ Step ${step}: ${message}`);
}

export function logOk(message: string) {
  console.log(`        ✓ ${message}`);
}

export function logDetail(message: string) {
  console.log(`          → ${message}`);
}

export interface ApiResponse<T = any> { success: boolean; data: T; error?: string; message?: string; }

export async function mainGet<T = any>(path: string, token?: string): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await axios.get(`${MAIN_API}${path}`, {
    headers,
    params: { format: 'json' },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function mainPost<T = any>(path: string, body: any, token?: string): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await axios.post(`${MAIN_API}${path}`, body, {
    headers,
    params: { format: 'json' },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function mainPut<T = any>(path: string, body: any, token?: string): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await axios.put(`${MAIN_API}${path}`, body, {
    headers,
    params: { format: 'json' },
    timeout: 30000,
  });
  return res.data;
}

export async function humansGet<T = any>(path: string, token: string): Promise<ApiResponse<T>> {
  const res = await axios.get(`${HUMANS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  return res.data;
}

export async function humansPost<T = any>(path: string, body: any, token: string): Promise<ApiResponse<T>> {
  const res = await axios.post(`${HUMANS_API}${path}`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function humansPut<T = any>(path: string, body: any, token: string): Promise<ApiResponse<T>> {
  const res = await axios.put(`${HUMANS_API}${path}`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error(`PUT ${path} → ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function humansDelete<T = any>(path: string, token: string): Promise<ApiResponse<T>> {
  const res = await axios.delete(`${HUMANS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  return res.data;
}

export async function createFirebaseUser(email: string, password: string): Promise<HumanState> {
  const res = await axios.post(`${FB_AUTH_URL}:signUp?key=${FB_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return {
    uid: res.data.localId,
    email: res.data.email,
    idToken: res.data.idToken,
  };
}

export async function signInFirebaseUser(email: string, password: string): Promise<string> {
  const res = await axios.post(`${FB_AUTH_URL}:signInWithPassword?key=${FB_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return res.data.idToken;
}

export async function deleteFirebaseUser(idToken: string): Promise<void> {
  try {
    await axios.post(`${FB_AUTH_URL}:delete?key=${FB_API_KEY}`, { idToken });
  } catch {
    // ignore cleanup errors
  }
}

export async function cleanupIdentities(token: string, ...ids: string[]): Promise<void> {
  for (const id of ids) {
    if (id) {
      try {
        await humansDelete(`/v1/identities/${id}`, token);
      } catch {
        // ignore
      }
    }
  }
}
