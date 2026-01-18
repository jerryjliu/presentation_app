"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, Presentation, Slide, ParseResult, TemplateResult } from "@/types";
import { ChatPanel } from "@/components/ChatPanel";
import { SlideViewer } from "@/components/SlideViewer";
import { SlideGrid } from "@/components/SlideGrid";
import { ExportMenu } from "@/components/ExportMenu";
import { ContextFilesUpload } from "@/components/ContextFilesUpload";
import { TemplateUpload } from "@/components/TemplateUpload";
import { TemplatePreview } from "@/components/TemplatePreview";
import ApiKeyGate, { clearStoredApiKeys } from "@/components/ApiKeyGate";
import { getSessionSlides } from "@/lib/api";
import {
  generateSessionId,
  getSessionFromUrl,
  setSessionInUrl,
  saveSessionToStorage,
  loadSessionFromStorage,
} from "@/lib/session";

export default function Home() {
  // Session state
  const [userSessionId, setUserSessionId] = useState<string | null>(null);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);

  // Presentation state
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Context files state
  const [contextFiles, setContextFiles] = useState<ParseResult[]>([]);
  const [parseMode, setParseMode] = useState<"cost_effective" | "premium">("cost_effective");

  // Style template state
  const [styleTemplate, setStyleTemplate] = useState<TemplateResult | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);

  // API key state
  const [llamaApiKey, setLlamaApiKey] = useState<string | null>(null);
  const [anthropicApiKey, setAnthropicApiKey] = useState<string | null>(null);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      // Check URL for session ID
      const urlSessionId = getSessionFromUrl();

      if (urlSessionId) {
        // Try to restore from URL session
        const stored = loadSessionFromStorage(urlSessionId);
        if (stored) {
          setUserSessionId(stored.userSessionId || urlSessionId);
          setAgentSessionId(stored.agentSessionId || null);
          setMessages(stored.messages || []);
        } else {
          setUserSessionId(urlSessionId);
        }

        // Fetch slides from backend
        try {
          const sessionSlides = await getSessionSlides(urlSessionId);
          setSlides(sessionSlides);
          if (sessionSlides.length > 0) {
            setPresentation({
              title: "Restored Presentation",
              slides: sessionSlides,
              theme: {},
            });
          }
        } catch (e) {
          console.log("Could not fetch slides for session:", e);
        }
      } else {
        // Create new session
        const newSessionId = generateSessionId();
        setUserSessionId(newSessionId);
        setSessionInUrl(newSessionId);
      }

      setIsLoading(false);
    };

    initSession();
  }, []);

  // Save session to storage when it changes
  useEffect(() => {
    if (userSessionId && messages.length > 0) {
      saveSessionToStorage({
        userSessionId,
        agentSessionId,
        messages,
        presentation,
      });
    }
  }, [userSessionId, agentSessionId, messages, presentation]);

  // Handle session update from chat
  const handleSessionUpdate = useCallback(
    (newUserSessionId: string, newAgentSessionId: string) => {
      setUserSessionId(newUserSessionId);
      setAgentSessionId(newAgentSessionId);
      setSessionInUrl(newUserSessionId);
    },
    []
  );

  // Handle slides update
  const handleSlidesUpdate = useCallback(async () => {
    if (!userSessionId) return;

    try {
      const sessionSlides = await getSessionSlides(userSessionId);
      setSlides(sessionSlides);

      if (sessionSlides.length > 0) {
        setPresentation({
          title: "My Presentation",
          slides: sessionSlides,
          theme: {},
        });

        // Reset to first slide if we were beyond the slide count
        if (currentSlideIndex >= sessionSlides.length) {
          setCurrentSlideIndex(0);
        }
      }
    } catch (e) {
      console.error("Failed to fetch slides:", e);
    }
  }, [userSessionId, currentSlideIndex]);

  // Handle new session
  const handleNewSession = useCallback(() => {
    const newSessionId = generateSessionId();
    setUserSessionId(newSessionId);
    setAgentSessionId(null);
    setSessionInUrl(newSessionId);
    setMessages([]);
    setSlides([]);
    setPresentation(null);
    setCurrentSlideIndex(0);
    setContextFiles([]);
    setStyleTemplate(null);
  }, []);

  // Handle context files
  const handleFilesProcessed = useCallback((results: ParseResult[]) => {
    setContextFiles((prev) => [...prev, ...results]);
  }, []);

  const handleRemoveContextFile = useCallback((filename: string) => {
    setContextFiles((prev) => prev.filter((f) => f.filename !== filename));
  }, []);

  // Handle style template
  const handleTemplateProcessed = useCallback((result: TemplateResult) => {
    setStyleTemplate(result);
  }, []);

  const handleRemoveTemplate = useCallback(() => {
    setStyleTemplate(null);
  }, []);

  // Handle slide content updates from inline editing
  const handleSlideUpdate = useCallback((index: number, html: string) => {
    setSlides((prevSlides) =>
      prevSlides.map((slide, i) =>
        i === index ? { ...slide, html } : slide
      )
    );
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <ApiKeyGate onApiKeyValidated={(llama, anthropic) => {
      setLlamaApiKey(llama);
      setAnthropicApiKey(anthropic);
    }}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 px-6 py-3 border-b border-border flex items-center justify-between bg-background">
          <div className="flex items-center gap-3">
            <img
              src="/llamaindex-logo.png"
              alt="LlamaIndex"
              className="w-8 h-8 rounded-lg"
            />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Presentation Generator</h1>
              <p className="text-xs text-foreground-muted">AI-powered presentation creation by LlamaIndex</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleNewSession}
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              + New Presentation
            </button>
            <ExportMenu
              sessionId={userSessionId}
              presentationTitle={presentation?.title || "presentation"}
              disabled={slides.length === 0}
            />
            <button
              onClick={() => {
                clearStoredApiKeys();
                setLlamaApiKey(null);
                setAnthropicApiKey(null);
                window.location.reload();
              }}
              className="text-xs text-foreground-muted hover:text-error transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel - Slide viewer */}
        <div className="w-1/2 flex border-r">
          {/* Slide grid sidebar */}
          <div className="w-40 border-r bg-white overflow-y-auto">
            <SlideGrid
              slides={slides}
              currentIndex={currentSlideIndex}
              onSlideSelect={setCurrentSlideIndex}
            />
          </div>

          {/* Main slide viewer */}
          <SlideViewer
            slides={slides}
            currentIndex={currentSlideIndex}
            onIndexChange={setCurrentSlideIndex}
            sessionId={userSessionId || undefined}
            onSlideUpdate={handleSlideUpdate}
          />
        </div>

        {/* Right panel - Chat */}
        <div className="w-1/2 bg-white flex flex-col">
          {/* Context Files Section */}
          <div className="border-b p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Context Files</h3>
              {contextFiles.length > 0 && (
                <span className="text-xs text-gray-500">
                  {contextFiles.length} file{contextFiles.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Uploaded files list */}
            {contextFiles.length > 0 && (
              <div className="mb-3 space-y-1">
                {contextFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1"
                  >
                    <span className="truncate text-gray-600 flex-1 mr-2">
                      {file.filename}
                    </span>
                    <button
                      onClick={() => handleRemoveContextFile(file.filename)}
                      className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload component */}
            {userSessionId && (
              <ContextFilesUpload
                userSessionId={userSessionId}
                onFilesProcessed={handleFilesProcessed}
                parseMode={parseMode}
                onParseModeChange={setParseMode}
                apiKey={llamaApiKey || undefined}
              />
            )}

            {/* Style Template Section */}
            <div className="mt-4 pt-4 border-t">
              {styleTemplate ? (
                <TemplatePreview
                  template={styleTemplate}
                  onRemove={handleRemoveTemplate}
                />
              ) : (
                userSessionId && (
                  <TemplateUpload
                    userSessionId={userSessionId}
                    onTemplateProcessed={handleTemplateProcessed}
                    apiKey={llamaApiKey || undefined}
                  />
                )
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              messages={messages}
              onMessagesUpdate={setMessages}
              userSessionId={userSessionId}
              agentSessionId={agentSessionId}
              onSessionUpdate={handleSessionUpdate}
              onSlidesUpdate={handleSlidesUpdate}
              isFirstMessage={messages.length === 0}
              contextFiles={contextFiles}
            />
          </div>
        </div>
      </main>
      </div>
    </ApiKeyGate>
  );
}
