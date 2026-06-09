import type { Metadata } from "next";
import "./globals.css";
import CommandPalette from "./components/CommandPalette";
import AppLayout from "./components/lib/AppLayout";

export const metadata: Metadata = {
  title: "Harness Operator UI",
  description: "Monitor and manage autonomous coding agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CommandPalette />
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
