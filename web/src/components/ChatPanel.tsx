"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, AgentLogEntry, StreamEvent } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { streamAgent } from "@/lib/api";

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Format tool name to be more readable
function formatToolName(name: string): string {
  return name
    .replace(/^mcp__presentation__/, "") // Remove MCP prefix
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Create a log entry from a stream event
function createLogEntry(event: StreamEvent): AgentLogEntry | null {
  const id = generateId();
  const timestamp = new Date();

  switch (event.type) {
    case "init":
      return {
        id,
        type: "init",
        timestamp,
        content: event.message || "Initializing agent...",
        message: event.message,
      };

    case "status":
      return {
        id,
        type: "status",
        timestamp,
        content: event.message || "Processing...",
        message: event.message,
      };

    case "tool_use": {
      // Use friendly descriptions if available from backend
      const friendlyMessages = event.friendly;
      const detailsMessages = event.details;

      if (friendlyMessages && friendlyMessages.length > 0) {
        return {
          id,
          type: "tool_use",
          timestamp,
          content:
            friendlyMessages.length > 1
              ? `Updating ${friendlyMessages.length} elements`
              : friendlyMessages[0],
          // Use details from backend (slide content) if available
          details: detailsMessages?.[0] || undefined,
          toolName: event.tool_calls?.[0]?.name,
          toolInput: event.tool_calls?.[0]?.input,
        };
      }
      // Fallback to formatted tool name
      const toolName = event.tool_calls?.[0]?.name || "tool";
      return {
        id,
        type: "tool_use",
        timestamp,
        content: formatToolName(toolName),
        details: detailsMessages?.[0] || undefined,
        toolName,
        toolInput: event.tool_calls?.[0]?.input,
      };
    }

    case "complete":
      return {
        id,
        type: "status",
        timestamp,
        content: `Completed - ${event.slide_count} slides`,
      };

    case "error":
      return {
        id,
        type: "status",
        timestamp,
        content: event.error || "An error occurred",
      };

    default:
      return null;
  }
}

interface ChatPanelProps {
  messages: ChatMessageType[];
  onMessagesUpdate: (messages: ChatMessageType[]) => void;
  userSessionId: string | null;
  agentSessionId: string | null;
  onSessionUpdate: (userSessionId: string, agentSessionId: string) => void;
  onSlidesUpdate: () => void;
  isFirstMessage: boolean;
  contextFiles?: Array<{ filename: string; text: string; success: boolean }>;
}

export function ChatPanel({
  messages,
  onMessagesUpdate,
  userSessionId,
  agentSessionId,
  onSessionUpdate,
  onSlidesUpdate,
  isFirstMessage,
  contextFiles,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      status: "complete",
    };

    // Add user message and create placeholder for assistant
    const assistantMessage: ChatMessageType = {
      id: `msg_${Date.now() + 1}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      status: "streaming",
      agentLog: [],
    };

    onMessagesUpdate([...messages, userMessage, assistantMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const currentLog: AgentLogEntry[] = [];
      let newUserSessionId = userSessionId;
      let newAgentSessionId = agentSessionId;
      let slideCount = 0;

      for await (const event of streamAgent({
        instructions: userMessage.content,
        isContinuation: !isFirstMessage,
        resumeSessionId: agentSessionId || undefined,
        userSessionId: userSessionId || undefined,
        contextFiles: contextFiles,
      })) {
        // Create log entry from event (don't accumulate assistant text)
        const logEntry = createLogEntry(event);
        if (logEntry) {
          currentLog.push(logEntry);
        }

        // Track session IDs and slide count from complete event
        if (event.type === "complete") {
          newUserSessionId = event.user_session_id;
          newAgentSessionId = event.session_id;
          slideCount = event.slide_count;
        } else if (event.type === "error") {
          throw new Error(event.error);
        }

        // Update the assistant message in real-time (log only, not content)
        const updatedAssistantMessage: ChatMessageType = {
          ...assistantMessage,
          content: "", // Keep empty during streaming
          agentLog: [...currentLog],
        };

        onMessagesUpdate([
          ...messages,
          userMessage,
          updatedAssistantMessage,
        ]);
      }

      // Final update with complete status
      const finalContent =
        slideCount > 0
          ? `Done! Created ${slideCount} slides.`
          : "Done! Your presentation has been updated.";

      const finalAssistantMessage: ChatMessageType = {
        ...assistantMessage,
        content: finalContent,
        status: "complete",
        agentLog: currentLog,
      };

      onMessagesUpdate([...messages, userMessage, finalAssistantMessage]);

      // Update session IDs
      if (newUserSessionId && newAgentSessionId) {
        onSessionUpdate(newUserSessionId, newAgentSessionId);
      }

      // Refresh slides
      onSlidesUpdate();
    } catch (error) {
      console.error("Error in chat:", error);

      // Update message with error status
      const errorMessage: ChatMessageType = {
        ...assistantMessage,
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        status: "error",
      };

      onMessagesUpdate([...messages, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <h3 className="text-lg font-medium mb-2">
              Create a Presentation
            </h3>
            <p className="text-sm">
              Describe the presentation you want to create.
              <br />
              For example: &quot;Create a 5-slide presentation about climate change&quot;
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isFirstMessage
                ? "Describe your presentation..."
                : "Ask to modify the presentation..."
            }
            disabled={isLoading}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
