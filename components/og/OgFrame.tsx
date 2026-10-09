import { BRAND } from "@/lib/brand";

/** Shared 1200x630 frame for link preview images (rendered by next/og, so inline styles only). */
export function OgFrame({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        color: "white",
        background: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🚐</div>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{BRAND.name}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: "#fcd34d", textTransform: "uppercase", letterSpacing: 2 }}>{eyebrow}</div>
        <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>{children}</div>
    </div>
  );
}

export function OgPill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "14px 28px",
        whiteSpace: "nowrap",
        flexShrink: 0,
        borderRadius: 999,
        fontSize: 30,
        fontWeight: 700,
        background: accent ? "#f59e0b" : "rgba(255,255,255,0.14)",
        color: accent ? "#0f172a" : "white",
      }}
    >
      {children}
    </div>
  );
}
