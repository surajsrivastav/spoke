import type { Metadata } from "next";
import "./globals.css";
import CommandPalette from "./components/CommandPalette";
import AppLayout from "./components/lib/AppLayout";
import { ThemeProvider } from "./components/lib/ThemeContext";

export const metadata: Metadata = {
  title: "Spoke Operator UI",
  description: "Monitor and manage autonomous coding agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <CommandPalette />
          <AppLayout>{children}</AppLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
