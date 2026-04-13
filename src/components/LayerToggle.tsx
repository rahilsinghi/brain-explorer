"use client";

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

  const handleChange = (layer: LayerMode) => {
    setActiveLayer(layer);
    updateUrlParams({ layer });
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30">
      <div
        className="flex rounded-full p-0.5"
        style={{
          background: "rgba(15, 15, 30, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        {LAYERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            className="px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200"
            style={{
              color: activeLayer === value ? "#e8eaf0" : "#64748b",
              background:
                activeLayer === value
                  ? "rgba(255,255,255,0.1)"
                  : "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
