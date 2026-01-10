"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, Presentation, Slide } from "@/types";
import { ChatPanel } from "@/components/ChatPanel";
import { SlideViewer } from "@/components/SlideViewer";
import { SlideGrid } from "@/components/SlideGrid";
import { ExportMenu } from "@/components/ExportMenu";
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

  // UI state
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">
            AI Presentation Generator
          </h1>
          <button
            onClick={handleNewSession}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + New Presentation
          </button>
        </div>
        <ExportMenu
          sessionId={userSessionId}
          presentationTitle={presentation?.title || "presentation"}
          disabled={slides.length === 0}
        />
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
          />
        </div>

        {/* Right panel - Chat */}
        <div className="w-1/2 bg-white">
          <ChatPanel
            messages={messages}
            onMessagesUpdate={setMessages}
            userSessionId={userSessionId}
            agentSessionId={agentSessionId}
            onSessionUpdate={handleSessionUpdate}
            onSlidesUpdate={handleSlidesUpdate}
            isFirstMessage={messages.length === 0}
          />
        </div>
      </main>
    </div>
  );
}
