"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, AgentLogEntry } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { streamAgent } from "@/lib/api";

interface ChatPanelProps {
  messages: ChatMessageType[];
  onMessagesUpdate: (messages: ChatMessageType[]) => void;
  userSessionId: string | null;
  agentSessionId: string | null;
  onSessionUpdate: (userSessionId: string, agentSessionId: string) => void;
  onSlidesUpdate: () => void;
  isFirstMessage: boolean;
}

export function ChatPanel({
  messages,
  onMessagesUpdate,
  userSessionId,
  agentSessionId,
  onSessionUpdate,
  onSlidesUpdate,
  isFirstMessage,
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
      let currentContent = "";
      const currentLog: AgentLogEntry[] = [];
      let newUserSessionId = userSessionId;
      let newAgentSessionId = agentSessionId;

      for await (const event of streamAgent({
        instructions: userMessage.content,
        isContinuation: !isFirstMessage,
        resumeSessionId: agentSessionId || undefined,
        userSessionId: userSessionId || undefined,
      })) {
        // Process event based on type
        if (event.type === "init") {
          currentLog.push({
            type: "init",
            timestamp: new Date(),
            message: event.message,
          });
        } else if (event.type === "status") {
          currentLog.push({
            type: "status",
            timestamp: new Date(),
            message: event.message,
          });
        } else if (event.type === "tool_use") {
          for (const toolCall of event.tool_calls) {
            currentLog.push({
              type: "tool_use",
              timestamp: new Date(),
              toolName: toolCall.name,
              toolInput: toolCall.input,
            });
          }
        } else if (event.type === "assistant") {
          currentContent += event.text;
        } else if (event.type === "complete") {
          newUserSessionId = event.user_session_id;
          newAgentSessionId = event.session_id;
        } else if (event.type === "error") {
          throw new Error(event.error);
        }

        // Update the assistant message in real-time
        const updatedAssistantMessage: ChatMessageType = {
          ...assistantMessage,
          content: currentContent,
          agentLog: [...currentLog],
        };

        onMessagesUpdate([
          ...messages,
          userMessage,
          updatedAssistantMessage,
        ]);
      }

      // Final update with complete status
      const finalAssistantMessage: ChatMessageType = {
        ...assistantMessage,
        content: currentContent || "Done! Your presentation has been updated.",
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
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
