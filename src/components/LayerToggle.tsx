"use client";

import { useMemo } from "react";
import type { LayerMode } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";
import { updateUrlParams } from "@/lib/url-params";

const LAYERS: { value: LayerMode; label: string }[] = [
  { value: "wiki", label: "Wiki" },
  { value: "code", label: "Code" },
  { value: "combined", label: "All" },
];

export function LayerToggle() {
  const activeLayer = useGraphState((s) => s.activeLayer);
  const setActiveLayer = useGraphState((s) => s.setActiveLayer);

  const activeIndex = useMemo(
    () => LAYERS.findIndex((l) => l.value === activeLayer),
    [activeLayer],
  );

  const handleChange = (layer: LayerMode) => {
    setActiveLayer(layer);
    updateUrlParams({ layer });
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-30" style={{ top: "24px" }}>
      <div
        className="relative flex items-center"
        style={{
          padding: "4px",
          borderRadius: "16px",
          background: "rgba(10, 10, 25, 0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        }}
      >
        {/* Sliding pill indicator */}
        <div
          style={{
            position: "absolute",
            top: "4px",
            left: `calc(4px + ${activeIndex} * (100% - 8px) / 3)`,
            width: `calc((100% - 8px) / 3)`,
            height: "calc(100% - 8px)",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
            transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: "none",
          }}
        />

        {LAYERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            style={{
              position: "relative",
              zIndex: 1,
              padding: "8px 24px",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              borderRadius: "12px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color:
                activeLayer === value
                  ? "rgba(255, 255, 255, 0.95)"
                  : "rgba(255, 255, 255, 0.35)",
              transition: "color 0.25s ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
