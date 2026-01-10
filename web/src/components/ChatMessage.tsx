"use client";

import { useState } from "react";
import type { ChatMessage as ChatMessageType } from "@/types";
import { AgentActivityLog } from "./AgentActivityLog";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : isAssistant
            ? "bg-gray-100 text-gray-900"
            : "bg-yellow-50 text-yellow-800 border border-yellow-200"
        }`}
      >
        {/* Status indicator for streaming */}
        {message.status === "streaming" && (
          <div className="flex items-center gap-2 mb-2 text-sm opacity-75">
            <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
            <span>Thinking...</span>
          </div>
        )}

        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* Error status */}
        {message.status === "error" && (
          <div className="mt-2 text-red-600 text-sm">
            An error occurred while processing this message.
          </div>
        )}

        {/* Agent activity log */}
        {isAssistant && message.agentLog && message.agentLog.length > 0 && (
          <AgentActivityLog
            log={message.agentLog}
            isExpanded={isLogExpanded}
            onToggle={() => setIsLogExpanded(!isLogExpanded)}
          />
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? "text-blue-200" : "text-gray-400"
          }`}
        >
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
