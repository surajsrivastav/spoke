"use client";

import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          marginLeft: "var(--sidebar-width)",
          flex: 1,
          padding: "var(--sp-6) var(--sp-6)",
          minHeight: "100vh",
          maxWidth: "100%",
          overflow: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}
