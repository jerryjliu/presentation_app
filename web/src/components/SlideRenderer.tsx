"use client";

import { useRef, useState, useLayoutEffect } from "react";

interface SlideRendererProps {
  html: string;
  width?: number;
  height?: number;
  scale?: number;
}

export function SlideRenderer({
  html,
  width = 960,
  height = 540,
  scale = 1,
}: SlideRendererProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [contentScale, setContentScale] = useState(1);

  // Measure true content size using an unconstrained hidden container
  useLayoutEffect(() => {
    // Create a hidden measurement container
    const measureContainer = document.createElement("div");
    measureContainer.style.cssText = `
      position: absolute;
      visibility: hidden;
      left: -9999px;
      top: -9999px;
    `;

    // Insert HTML and let it render at natural size
    measureContainer.innerHTML = html;
    document.body.appendChild(measureContainer);

    // Force all elements to have overflow visible and no fixed dimensions
    // so we can measure true content size
    const allElements = measureContainer.querySelectorAll("*");
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.overflow = "visible";
      htmlEl.style.maxHeight = "none";
      htmlEl.style.height = "auto";
    });
    // Also fix the root element if it has constraints
    const rootEl = measureContainer.firstElementChild as HTMLElement;
    if (rootEl) {
      rootEl.style.overflow = "visible";
      rootEl.style.height = "auto";
      rootEl.style.maxHeight = "none";
    }

    // Measure after DOM update
    requestAnimationFrame(() => {
      // Get bounding rect of the container
      const rect = measureContainer.getBoundingClientRect();
      let contentWidth = rect.width;
      let contentHeight = rect.height;

      // Check all children for max bounds (in case of absolute positioning)
      allElements.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const elRight = elRect.left - rect.left + elRect.width;
        const elBottom = elRect.top - rect.top + elRect.height;
        contentWidth = Math.max(contentWidth, elRight);
        contentHeight = Math.max(contentHeight, elBottom);
      });

      // Clean up
      document.body.removeChild(measureContainer);

      // Calculate scale needed to fit within slide bounds
      if (contentWidth > width || contentHeight > height) {
        const scaleX = width / contentWidth;
        const scaleY = height / contentHeight;
        const fitScale = Math.min(scaleX, scaleY, 1);
        setContentScale(fitScale * 0.92); // 8% margin for safety
      } else {
        setContentScale(1);
      }
    });
  }, [html, width, height]);

  const totalScale = contentScale * scale;

  return (
    <div
      className="slide-container bg-white shadow-lg"
      style={{
        width: width * scale,
        height: height * scale,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        ref={measureRef}
        className="slide-content"
        style={{
          transform: `scale(${totalScale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
          backgroundColor: "white",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
