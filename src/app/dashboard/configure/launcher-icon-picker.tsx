"use client";

import { Bot, Check } from "lucide-react";
import { DEFAULT_LAUNCHER_ICON, LAUNCHER_ICONS, launcherIconUrl } from "@/lib/launcherIcons";
import { DEFAULT_TEASER } from "@/lib/widgetTeaser";

/** The chat icon as it appears on the launcher: the artwork drawn in the bubble colour, or the robot on that colour. */
function IconFace({ id, bubbleColor, size }: { id: string; bubbleColor: string; size: number }) {
  const src = launcherIconUrl(id, bubbleColor);
  if (src) {
    return <img src={src} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size, objectFit: "contain" }} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: bubbleColor, color: "#0b0f14", borderRadius: "50%", display: "grid", placeItems: "center" }}
    >
      <Bot style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}

/** What visitors see on their site: the icon with the message beside it. */
export function LauncherPreview({ icon, bubbleColor }: { icon?: string; bubbleColor: string }) {
  const id = icon || DEFAULT_LAUNCHER_ICON;
  return (
    <div
      aria-label="Chat icon preview"
      style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 14, padding: 12, borderRadius: 14, background: "#f1f5f9" }}
    >
      <div style={{ background: "#fff", color: "#111827", fontSize: 13, padding: "8px 12px", borderRadius: 12, boxShadow: "0 4px 14px rgba(0,0,0,.12)", maxWidth: 170 }}>
        {DEFAULT_TEASER}
      </div>
      <IconFace id={id} bubbleColor={bubbleColor} size={52} />
    </div>
  );
}

/**
 * Choose the chat icon for the website widget: the built-in robot (which takes the bubble colour) or one of the ready-made
 * icons. A radio group, so it works from the keyboard and reads properly to screen readers.
 */
export function LauncherIconPicker({
  value,
  bubbleColor,
  onChange,
}: {
  value?: string;
  bubbleColor: string;
  onChange: (id: string) => void;
}) {
  const current = value || DEFAULT_LAUNCHER_ICON;
  return (
    <div role="radiogroup" aria-label="Chat icon" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 10 }}>
      {LAUNCHER_ICONS.map((icon) => {
        const selected = current === icon.id;
        return (
          <button
            key={icon.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(icon.id)}
            className="nb-focus"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "12px 8px 10px",
              borderRadius: 12,
              cursor: "pointer",
              background: selected ? "color-mix(in srgb, var(--signal) 8%, transparent)" : "var(--nb-surface-2)",
              border: selected ? "1px solid #36f4a4" : "1px solid var(--nb-line)",
              boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--signal) 14%, transparent)" : "none",
              color: "var(--foreground)",
            }}
          >
            <IconFace id={icon.id} bubbleColor={bubbleColor} size={48} />
            <span style={{ fontSize: 12, color: selected ? "#fff" : "var(--nb-text-secondary)" }}>{icon.name}</span>
            {selected && (
              <span
                aria-hidden="true"
                style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: "var(--signal)", color: "#000", display: "grid", placeItems: "center" }}
              >
                <Check style={{ width: 11, height: 11 }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
