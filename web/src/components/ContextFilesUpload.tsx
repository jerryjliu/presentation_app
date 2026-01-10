"use client";

import { useState, useRef } from "react";
import { streamParseFiles } from "@/lib/api";
import type { ParseResult } from "@/types";

interface ContextFilesUploadProps {
  userSessionId: string;
  onFilesProcessed: (results: ParseResult[]) => void;
}

export function ContextFilesUpload({
  userSessionId,
  onFilesProcessed,
}: ContextFilesUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    filename: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessing(true);
    setProgress(null);

    try {
      const results: ParseResult[] = [];

      for await (const event of streamParseFiles(fileArray, userSessionId)) {
        if (event.type === "progress") {
          setProgress({
            current: event.current || 0,
            total: event.total || 0,
            filename: event.filename || "",
          });
        } else if (event.type === "complete" && event.results) {
          results.push(...event.results);
        } else if (event.type === "error") {
          console.error("Parse error:", event.error);
        }
      }

      onFilesProcessed(results);
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div
      className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md"
      />

      {isProcessing ? (
        <div className="text-sm text-gray-600">
          <div className="animate-pulse mb-2">Processing files...</div>
          {progress && (
            <div>
              {progress.filename} ({progress.current}/{progress.total})
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-600">
          <div className="mb-1">Drop files here or click to upload</div>
          <div className="text-xs text-gray-400">
            PDF, DOC, DOCX, TXT, MD supported
          </div>
        </div>
      )}
    </div>
  );
}
