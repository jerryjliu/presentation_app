"use client";

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
  return (
    <div
      className="slide-container bg-white shadow-lg overflow-hidden"
      style={{
        width: width * scale,
        height: height * scale,
      }}
    >
      <div
        className="slide-content"
        style={{
          width: width,
          height: height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
