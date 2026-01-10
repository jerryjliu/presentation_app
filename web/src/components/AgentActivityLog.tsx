"use client";

import type { AgentLogEntry } from "@/types";

interface AgentActivityLogProps {
  log: AgentLogEntry[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function AgentActivityLog({
  log,
  isExpanded,
  onToggle,
}: AgentActivityLogProps) {
  if (log.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={onToggle}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <span>{isExpanded ? "Hide" : "Show"} agent activity</span>
        <span className="text-gray-400">({log.length} actions)</span>
      </button>

      {isExpanded && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
          {log.map((entry, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-gray-400">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              {entry.type === "tool_use" && entry.toolName && (
                <span className="text-blue-600">
                  Tool: {entry.toolName}
                  {entry.toolInput && (
                    <span className="text-gray-500 ml-1">
                      ({JSON.stringify(entry.toolInput).slice(0, 50)}...)
                    </span>
                  )}
                </span>
              )}
              {entry.type === "status" && (
                <span className="text-gray-600">{entry.message}</span>
              )}
              {entry.type === "init" && (
                <span className="text-green-600">{entry.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
