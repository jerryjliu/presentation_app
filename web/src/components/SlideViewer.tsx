"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { Slide } from "@/types";
import { SlideRenderer } from "./SlideRenderer";
import { updateSlideContent } from "@/lib/api";

interface SlideViewerProps {
  slides: Slide[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  sessionId?: string;
  onSlideUpdate?: (index: number, html: string) => void;
}

export function SlideViewer({
  slides,
  currentIndex,
  onIndexChange,
  sessionId,
  onSlideUpdate,
}: SlideViewerProps) {
  const totalSlides = slides.length;
  const currentSlide = slides[currentIndex];
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 337.5 });

  // Dynamic scale calculation based on container size
  const scale = Math.min(
    containerSize.width / 960,
    containerSize.height / 540
  );

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  }, [currentIndex, onIndexChange]);

  const goToNext = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      onIndexChange(currentIndex + 1);
    }
  }, [currentIndex, totalSlides, onIndexChange]);

  // Keyboard navigation - supports both Left/Right and Up/Down arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keyboard events when user is typing in an input or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevious, goToNext]);

  // ResizeObserver for dynamic scaling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        // Account for padding (p-4 = 16px on each side)
        setContainerSize({
          width: Math.max(width - 32, 100),
          height: Math.max(height - 32, 56.25),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleContentChange = useCallback(
    async (newHtml: string) => {
      // Update local state first for immediate feedback
      if (onSlideUpdate) {
        onSlideUpdate(currentIndex, newHtml);
      }

      // Persist to backend
      if (sessionId) {
        try {
          await updateSlideContent(sessionId, currentIndex, newHtml);
        } catch (e) {
          console.error("Failed to save slide:", e);
          // TODO: Show error toast to user
        }
      }
    },
    [sessionId, currentIndex, onSlideUpdate]
  );

  if (totalSlides === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">&#128196;</div>
          <div>No slides to display</div>
          <div className="text-sm mt-2">
            Start a conversation to create your presentation
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Main slide display */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-gray-100 p-4">
        {currentSlide && (
          <SlideRenderer
            html={currentSlide.html}
            scale={scale}
            editable={!!sessionId}
            onContentChange={handleContentChange}
          />
        )}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between p-3 bg-white border-t">
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Previous
        </button>

        <span className="text-sm text-gray-600">
          {currentIndex + 1} / {totalSlides}
        </span>

        <button
          onClick={goToNext}
          disabled={currentIndex === totalSlides - 1}
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
