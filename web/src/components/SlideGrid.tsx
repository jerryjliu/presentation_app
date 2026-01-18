"use client";

import type { Slide } from "@/types";
import { SlideRenderer } from "./SlideRenderer";

interface SlideGridProps {
  slides: Slide[];
  currentIndex: number;
  onSlideSelect: (index: number) => void;
}

export function SlideGrid({
  slides,
  currentIndex,
  onSlideSelect,
}: SlideGridProps) {
  if (slides.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        No slides yet
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2 overflow-y-auto">
      {slides.map((slide, index) => (
        <button
          key={slide.index}
          onClick={() => onSlideSelect(index)}
          className={`w-full p-1 rounded transition-all ${
            currentIndex === index
              ? "ring-2 ring-accent bg-accent-light"
              : "hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-6">{index + 1}</span>
            <div className="flex-1 overflow-hidden rounded border">
              <SlideRenderer html={slide.html} scale={0.15} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
