import { ObjectId } from 'mongodb';

export interface Conversation {
  _id?: ObjectId;
  userId: string;           // chatbot owner
  sessionId: string;        // visitor session (from embed.js localStorage)
  visitorId: string;        // persistent visitor fingerprint
  website: string;          // hostname of embedded site
  messageCount: number;
  startedAt: Date;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  _id?: ObjectId;
  userId: string;
  conversationId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  responseTimeMs?: number;  // only for assistant messages
  sourceUrl?: string;       // page visitor was on
  metadata?: {
    browser?: string;
    device?: 'mobile' | 'desktop' | 'tablet';
    referrer?: string;
  };
  createdAt: Date;
}