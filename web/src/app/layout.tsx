import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Presentation Generator",
  description: "Create presentations with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
