import { cn } from "@/lib/utils";
export function Progress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const percentage = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return <div className={cn("progress-track", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><div className="progress-fill" style={{ width: `${percentage}%` }} /></div>;
}
