import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PlacePrep AI — Prepare for what’s next",
  description:
    "Your college placement preparation workspace. Practice coding, build confidence, and track real learning progress.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
