"use client";

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", color: "var(--text-tertiary)" }}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      <h2 style={{ fontSize: "var(--text-h3)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
        Settings
      </h2>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: 24 }}>
        Settings and configuration are coming soon.
      </p>
      <div
        style={{
          display: "inline-flex",
          gap: 16,
          padding: "var(--sp-5) var(--sp-6)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", lineHeight: 1.8 }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Planned settings</div>
          <div>• Model provider configuration</div>
          <div>• Budget alerts & thresholds</div>
          <div>• Verification gate rules</div>
          <div>• Notification preferences</div>
          <div>• Team & access management</div>
          <div>• Audit log retention</div>
        </div>
      </div>
    </div>
  );
}
