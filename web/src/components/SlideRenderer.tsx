"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface SlideRendererProps {
  html: string;
  width?: number;
  height?: number;
  scale?: number;
  editable?: boolean;
  onContentChange?: (html: string) => void;
}

export function SlideRenderer({
  html,
  width = 960,
  height = 540,
  scale = 1,
  editable = false,
  onContentChange,
}: SlideRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [originalHtml, setOriginalHtml] = useState(html);

  // Update originalHtml when html prop changes (e.g., navigating slides)
  useEffect(() => {
    if (!isEditing) {
      setOriginalHtml(html);
    }
  }, [html, isEditing]);

  // No dynamic measurement - AI generates 960x540 content, use fixed scale
  // Scale = container_size / base_size = scale prop (already passed in)

  const enterEditMode = useCallback(() => {
    if (!editable) return;
    setOriginalHtml(contentRef.current?.innerHTML || html);
    setIsEditing(true);
    // Focus the content after state update
    setTimeout(() => {
      contentRef.current?.focus();
    }, 0);
  }, [editable, html]);

  const exitEditMode = useCallback(
    (save: boolean) => {
      setIsEditing(false);
      if (save && onContentChange && contentRef.current) {
        const newHtml = contentRef.current.innerHTML;
        if (newHtml !== originalHtml) {
          onContentChange(newHtml);
        }
      } else if (!save && contentRef.current) {
        // Revert to original
        contentRef.current.innerHTML = originalHtml;
      }
    },
    [onContentChange, originalHtml]
  );

  const handleDoubleClick = useCallback(() => {
    if (!isEditing) {
      enterEditMode();
    }
  }, [isEditing, enterEditMode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitEditMode(false);
      }
    },
    [exitEditMode]
  );

  // Fixed scale - AI generates 960x540 content, scale to fit container
  const totalScale = scale;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`slide-container bg-white shadow-lg transition-all group ${
          isEditing ? "ring-2 ring-blue-500 ring-offset-2" : ""
        }`}
        style={{
          width: width * scale,
          height: height * scale,
          position: "relative",
          overflow: "hidden",
        }}
        onDoubleClick={handleDoubleClick}
      >
        <div
          ref={contentRef}
          className="slide-content"
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onKeyDown={isEditing ? handleKeyDown : undefined}
          style={{
            transform: `scale(${totalScale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            backgroundColor: "white",
            outline: "none",
            cursor: editable && !isEditing ? "text" : undefined,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Edit hint overlay - shown on hover when not editing */}
        {editable && !isEditing && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/50 text-white text-sm px-3 py-1.5 rounded-md">
              Double-click to edit
            </div>
          </div>
        )}
      </div>

      {/* Save/Cancel buttons - shown when editing */}
      {isEditing && (
        <div className="flex gap-2">
          <button
            onClick={() => exitEditMode(false)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => exitEditMode(true)}
            className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
