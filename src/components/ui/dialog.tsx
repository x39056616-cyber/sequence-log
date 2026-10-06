"use client";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
export function Dialog({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
    <div className={cn("panel w-full max-w-xl rounded-xl", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="serif text-lg gold-text">{title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭"><X className="size-4" /></Button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}
