import type { LayerMode } from "./types";

const VALID_LAYERS: LayerMode[] = ["wiki", "code", "combined"];

export function readLayerParam(): LayerMode | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("layer");
  if (raw && VALID_LAYERS.includes(raw as LayerMode)) return raw as LayerMode;
  return null;
}

export function readFocusParam(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("focus");
  return raw ? decodeURIComponent(raw) : null;
}

export function updateUrlParams(updates: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }
  window.history.replaceState({}, "", url.toString());
}
