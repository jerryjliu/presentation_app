/**
 * Type definitions for the presentation app.
 */

export interface Slide {
  index: number;
  html: string;
  layout: string;
  notes?: string;
}

export interface Presentation {
  title: string;
  slides: Slide[];
  theme: Record<string, string>;
}

export interface AgentLogEntry {
  type: "tool_use" | "status" | "init";
  timestamp: Date;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "pending" | "streaming" | "complete" | "error";
  agentLog?: AgentLogEntry[];
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export type StreamEvent =
  | { type: "init"; message: string; session_id: string }
  | { type: "status"; message: string }
  | { type: "tool_use"; tool_calls: ToolCall[]; friendly?: string[] }
  | { type: "assistant"; text: string }
  | {
      type: "complete";
      session_id: string;
      user_session_id: string;
      slide_count: number;
    }
  | { type: "error"; error: string };

export interface ParseProgress {
  type: "progress" | "complete" | "error";
  current?: number;
  total?: number;
  filename?: string;
  status?: string;
  results?: ParseResult[];
  error?: string;
}

export interface ParseResult {
  filename: string;
  text: string;
  success: boolean;
  error?: string;
}

export interface SessionState {
  userSessionId: string | null;
  agentSessionId: string | null;
  messages: ChatMessage[];
  presentation: Presentation | null;
}
