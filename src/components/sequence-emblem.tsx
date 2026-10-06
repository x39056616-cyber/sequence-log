import { cn } from "@/lib/utils";
export function SequenceEmblem({ symbol, size = 64, className }: { symbol: string; size?: number; className?: string }) {
  const seed = [...symbol].reduce((total, char) => total + char.charCodeAt(0), 0);
  const rotations = [0, 45, 90, 135, 180];
  return <svg viewBox="0 0 100 100" width={size} height={size} className={cn("shrink-0", className)} aria-hidden="true">
    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" />
    <circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" opacity=".7" />
    {rotations.map((rotation) => <path key={rotation} d="M50 8 L57 31 L50 39 L43 31 Z" fill="currentColor" opacity={rotation === 0 ? .7 : .28} transform={`rotate(${rotation + seed % 15} 50 50)`} />)}
    <path d={seed % 2 ? "M22 56 Q50 22 78 56 Q50 80 22 56Z" : "M24 50 Q50 20 76 50 Q50 80 24 50Z"} fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="50" cy="50" r={seed % 3 + 4} fill="currentColor" />
    <path d="M17 50 H83 M50 17 V83" stroke="currentColor" strokeWidth=".6" opacity=".25" />
  </svg>;
}
