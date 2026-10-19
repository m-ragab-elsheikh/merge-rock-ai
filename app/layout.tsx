import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merge Rock AI",
  description: "Merge Rock AI helps plan moves in the Merge Rock tile puzzle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
