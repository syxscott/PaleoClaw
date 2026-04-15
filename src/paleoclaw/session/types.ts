/**
 * PaleoClaw Session types
 */

export type SessionRole = 'system' | 'user' | 'assistant' | 'tool';

export interface SessionMessage {
  id: string;
  role: SessionRole;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  messages: SessionMessage[];
}

export interface SessionSearchHit {
  sessionId: string;
  title: string;
  messageId: string;
  score: number;
  preview: string;
  createdAt: string;
}
