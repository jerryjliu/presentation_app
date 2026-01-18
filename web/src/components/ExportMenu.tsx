"use client";

import { useState, useRef, useEffect } from "react";
import { exportPptx, exportPdf } from "@/lib/api";

interface ExportMenuProps {
  sessionId: string | null;
  presentationTitle: string;
  disabled: boolean;
}

type ExportFormat = "pptx" | "pdf";

export function ExportMenu({
  sessionId,
  presentationTitle,
  disabled,
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (format: ExportFormat) => {
    if (!sessionId) return;

    setIsMenuOpen(false);
    setIsExporting(true);
    setExportingFormat(format);

    try {
      const blob = format === "pptx"
        ? await exportPptx(sessionId)
        : await exportPdf(sessionId);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presentationTitle || "presentation"}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert(`Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const isDisabled = disabled || isExporting || !sessionId;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={isDisabled}
        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <span className="animate-spin">&#8635;</span>
            Exporting {exportingFormat?.toUpperCase()}...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PPTX
            <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && !isExporting && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={() => handleExport("pptx")}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm8 0v5h5l-5-5zM8 12v6h2v-2h1a2 2 0 002-2v0a2 2 0 00-2-2H8zm2 2v-1h1v1h-1z"/>
            </svg>
            <div>
              <div className="font-medium">PowerPoint (.pptx)</div>
              <div className="text-xs text-gray-500">Editable slides</div>
            </div>
          </button>

          <button
            onClick={() => handleExport("pdf")}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm8 0v5h5l-5-5zM7 12v6h1.5v-2h1a1.5 1.5 0 001.5-1.5v-1A1.5 1.5 0 009.5 12H7zm1.5 2.5v-1h1v1h-1zm3-2.5v6h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2zm1.5 4.5v-3h.5a.5.5 0 01.5.5v2a.5.5 0 01-.5.5H13zm4-4.5v6h1.5v-2.5h1v-1.5h-1V13.5h1V12H17z"/>
            </svg>
            <div>
              <div className="font-medium">PDF (.pdf)</div>
              <div className="text-xs text-gray-500">Pixel-perfect export</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
