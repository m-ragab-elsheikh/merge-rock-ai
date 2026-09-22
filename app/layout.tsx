import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merge Rock AI",
  description: "Move assistant for Merge Rock.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
