"use client";

import { useState } from "react";
import { exportPptx } from "@/lib/api";

interface ExportMenuProps {
  sessionId: string | null;
  presentationTitle: string;
  disabled: boolean;
}

export function ExportMenu({
  sessionId,
  presentationTitle,
  disabled,
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (!sessionId) return;

    setIsExporting(true);
    try {
      const blob = await exportPptx(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presentationTitle || "presentation"}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export presentation. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || isExporting || !sessionId}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
    >
      {isExporting ? (
        <>
          <span className="animate-spin">&#8635;</span>
          Exporting...
        </>
      ) : (
        <>
          <span>&#8681;</span>
          Download PPTX
        </>
      )}
    </button>
  );
}
