export type NetworkStatus = 'live' | 'testing';
export type MemberRole = 'member' | 'admin';
export type ConversationType = 'topic' | 'direct' | 'group';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected';

export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
  toDate(): Date;
}

export type Timestamp = Date | FirestoreTimestamp;

export interface Network {
  id?: string;
  name: string;
  description: string;
  longDescription: string;
  logoUrl: string;
  status: NetworkStatus;
  isPublic: boolean;
  users: number;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface Member {
  id?: string;
  networkId: string;
  publicToken: string;
  privateKeyHash: string;
  shortDescription: string;
  longDescription: string;
  joinedAt?: Timestamp;
  lastAccessReason?: string;
  role: MemberRole;
}

export interface Invitation {
  id?: string;
  networkId: string;
  fromUserId: string;
  toPublicToken?: string;
  status: InvitationStatus;
  createdAt?: Timestamp;
}

export interface ProfileQuestion {
  id?: string;
  networkId: string;
  question: string;
  order: number;
  required: boolean;
}

export interface Conversation {
  id?: string;
  networkId: string;
  title: string;
  type: ConversationType;
  maxMembers: number;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface Participant {
  id?: string;
  conversationId: string;
  userId: string;
  joinedAt?: Timestamp;
}

export interface Message {
  id?: string;
  conversationId: string;
  senderId: string;
  receiverId: string | null;
  content: string;
  replyTo?: string;
  createdAt?: Timestamp;
}

export interface NetworkShort {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  status: NetworkStatus;
  users: number;
}

export interface MemberShort {
  publicToken: string;
  shortDescription: string;
  role: MemberRole;
}

export interface ConversationShort {
  id: string;
  title: string;
  type: ConversationType;
  maxMembers: number;
}

export interface AuthCredentials {
  publicToken: string;
  privateKey: string;
}

export interface AuthTokens {
  jwt: string;
  expiresAt: number;
  publicToken: string;
}

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
