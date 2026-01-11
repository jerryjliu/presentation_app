/**
 * API client for the presentation app backend.
 */

import type { StreamEvent, Slide, ParseProgress } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Stream agent interaction for presentation creation/editing.
 */
export async function* streamAgent(options: {
  instructions: string;
  isContinuation: boolean;
  resumeSessionId?: string;
  userSessionId?: string;
  contextFiles?: Array<{ filename: string; text: string; success: boolean }>;
}): AsyncGenerator<StreamEvent> {
  const formData = new FormData();
  formData.append("instructions", options.instructions);
  formData.append("is_continuation", String(options.isContinuation));

  if (options.resumeSessionId) {
    formData.append("resume_session_id", options.resumeSessionId);
  }
  if (options.userSessionId) {
    formData.append("user_session_id", options.userSessionId);
  }
  if (options.contextFiles && options.contextFiles.length > 0) {
    formData.append("context_files", JSON.stringify(options.contextFiles));
  }

  const response = await fetch(`${API_BASE}/agent-stream`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          yield event;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith("data: ")) {
    try {
      const event: StreamEvent = JSON.parse(buffer.slice(6));
      yield event;
    } catch {
      // Skip invalid JSON
    }
  }
}

/**
 * Update a slide's HTML content.
 */
export async function updateSlideContent(
  sessionId: string,
  slideIndex: number,
  html: string
): Promise<void> {
  const formData = new FormData();
  formData.append("html", html);

  const response = await fetch(
    `${API_BASE}/session/${sessionId}/slides/${slideIndex}`,
    { method: "PATCH", body: formData }
  );

  if (!response.ok) {
    throw new Error(`Failed to update slide: ${response.status}`);
  }
}

/**
 * Get slides for a session.
 */
export async function getSessionSlides(sessionId: string): Promise<Slide[]> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/slides`);
  if (!response.ok) {
    throw new Error(`Failed to fetch slides: ${response.status}`);
  }
  const data = await response.json();
  return data.slides;
}

/**
 * Export presentation as PPTX.
 */
export async function exportPptx(sessionId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/export`);
  if (!response.ok) {
    throw new Error(`Failed to export PPTX: ${response.status}`);
  }
  return response.blob();
}

/**
 * Export presentation as PDF (pixel-perfect rendering).
 */
export async function exportPdf(sessionId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/export/pdf`);
  if (!response.ok) {
    throw new Error(`Failed to export PDF: ${response.status}`);
  }
  return response.blob();
}

/**
 * Stream file parsing progress.
 */
export async function* streamParseFiles(
  files: File[],
  userSessionId: string,
  parseMode: string = "cost_effective"
): AsyncGenerator<ParseProgress> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  formData.append("user_session_id", userSessionId);
  formData.append("parse_mode", parseMode);

  const response = await fetch(`${API_BASE}/parse-files`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event: ParseProgress = JSON.parse(line.slice(6));
          yield event;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

/**
 * Check if the backend is healthy.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
