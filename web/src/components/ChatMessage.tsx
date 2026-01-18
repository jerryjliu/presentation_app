"use client";

import type { ChatMessage as ChatMessageType } from "@/types";
import { AgentActivityLog } from "./AgentActivityLog";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isStreaming = message.status === "streaming";
  const hasContent = message.content && message.content.trim().length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg ${
          isUser
            ? "bg-accent text-white p-3"
            : isAssistant
            ? "bg-white border border-gray-200 shadow-sm"
            : "bg-yellow-50 text-yellow-800 border border-yellow-200 p-3"
        }`}
      >
        {isUser ? (
          <>
            {/* User message content */}
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
            {/* Timestamp */}
            <div className="text-xs mt-2 text-white/60">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </>
        ) : isAssistant ? (
          <>
            {/* Agent activity log - shows at top for assistant messages */}
            {message.agentLog && message.agentLog.length > 0 && (
              <div className="p-3 pb-0">
                <AgentActivityLog
                  log={message.agentLog}
                  isStreaming={isStreaming}
                  summary={hasContent ? undefined : "Processing your request..."}
                />
              </div>
            )}

            {/* Content section - only show when NOT streaming and has content */}
            {hasContent && message.status !== "streaming" && (
              <div className="p-3 pt-2">
                <div className="whitespace-pre-wrap break-words text-gray-900">
                  {message.content}
                </div>
              </div>
            )}

            {/* Error status */}
            {message.status === "error" && (
              <div className="px-3 pb-3 text-red-600 text-sm">
                An error occurred while processing this message.
              </div>
            )}

            {/* Timestamp */}
            <div className="px-3 pb-3 text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </>
        ) : (
          <>
            {/* System message */}
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
            <div className="text-xs mt-2 text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
