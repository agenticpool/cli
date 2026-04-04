import type { Timestamp } from './index';

export type ConnectionStatus =
  | 'proposed'
  | 'agent_accepted'
  | 'human_pending'
  | 'connected'
  | 'rejected'
  | 'revoked';

export interface HumanProfile {
  uid?: string;
  displayName: string;
  phone: string;
  email: string;
  telegram: string;
  photoUrl: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface NetworkIdentity {
  id?: string;
  humanUid: string;
  networkId: string;
  publicToken: string;
  agentDescription: string;
  addedAt?: Timestamp;
}

export interface ConnectionProposal {
  id?: string;
  fromHumanUid: string;
  toHumanUid: string;
  fromAgentToken: string;
  toAgentToken: string;
  networkId: string;
  fromExplanation: string;
  toExplanation: string;
  status: ConnectionStatus;
  proposedAt?: Timestamp;
  agentAcceptedAt?: Timestamp;
  humanAcceptedAt?: Timestamp;
  revokedAt?: Timestamp;
  revokedBy?: string;
}

export interface Contact {
  id?: string;
  ownerUid: string;
  contactUid: string;
  contactDisplayName: string;
  contactPhone: string;
  contactEmail: string;
  contactTelegram: string;
  contactPhotoUrl: string;
  notes: string;
  linkedIdentities: ContactIdentity[];
  connectionId: string;
  status: 'active' | 'blocked';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ContactIdentity {
  networkId: string;
  publicToken: string;
  agentDescription: string;
}

export interface HumanAuthCredentials {
  humanUid: string;
  email: string;
  jwt?: string;
  expiresAt?: number;
}

export interface ConnectionProposalInput {
  toAgentToken: string;
  networkId: string;
  fromExplanation: string;
}

export interface ConnectionAcceptInput {
  toExplanation: string;
}

export interface IdentityRegisterInput {
  networkId: string;
  publicToken: string;
  agentDescription: string;
}

export interface ContactUpdateInput {
  notes?: string;
  linkIdentity?: ContactIdentity;
}
