"use client";

import { useState, useEffect, useCallback } from "react";

type Status = "idle" | "checking" | "pushing" | "success" | "unreachable";

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  idle: { label: "", color: "" },
  checking: { label: "Checking daemon...", color: "#e2e8f0" },
  pushing: {
    label: "Deploying... graph will update in ~60s",
    color: "#00D1FF",
  },
  success: { label: "Graph pushed successfully", color: "#00FF41" },
  unreachable: {
    label: "Daemon unreachable (local dev only)",
    color: "#f87171",
  },
};

export function AdminRefresh() {
  const [status, setStatus] = useState<Status>("idle");

  const handleRefresh = useCallback(async () => {
    setStatus("checking");
    try {
      const healthRes = await fetch("http://localhost:3577/health", {
        signal: AbortSignal.timeout(3000),
      });
      if (!healthRes.ok) throw new Error("unhealthy");
      setStatus("pushing");
      const pushRes = await fetch("http://localhost:3577/graph-push", {
        method: "POST",
        signal: AbortSignal.timeout(30000),
      });
      if (!pushRes.ok) throw new Error("push failed");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 5000);
    } catch {
      setStatus("unreachable");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "R" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRefresh]);

  if (status === "idle") return null;
  const { label, color } = STATUS_CONFIG[status];

  return (
    <div className="fixed bottom-4 right-4 z-30">
      <span className="text-[11px] font-mono" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
