"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelPool } from "@/lib/types";

export interface WheelSlice {
  id: string;
  label: string;
  pool?: WheelPool;
}

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = SIZE / 2 - 12;

const SECTOR_COLORS = ["#c9a227", "#8c6d3f", "#a8842f", "#6f5a34", "#b79544", "#7d6a3c", "#c2a04a", "#94793a"];
const SPECIAL_COLORS: Record<string, string> = { transmigrator: "#5b7f95", oldOne: "#4d7a6a", special: "#6a5f95" };

function colorFor(slice: WheelSlice, index: number) {
  if (slice.pool && slice.pool !== "default") return SPECIAL_COLORS[slice.pool] ?? "#5b7f95";
  return SECTOR_COLORS[index % SECTOR_COLORS.length];
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function sectorPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const outerStart = polar(cx, cy, radius, start);
  const outerEnd = polar(cx, cy, radius, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return ["M", cx, cy, "L", outerStart.x, outerStart.y, "A", radius, radius, 0, largeArc, 1, outerEnd.x, outerEnd.y, "Z"].join(" ");
}

export function FateWheel({
  slices,
  targetIndex,
  spinKey,
  reducedMotion,
}: {
  slices: WheelSlice[];
  targetIndex: number | null;
  spinKey: string | null;
  reducedMotion?: boolean;
}) {
  const [rotation, setRotation] = useState(0);
  const turnsRef = useRef(0);

  const step = slices.length > 0 ? 360 / slices.length : 360;
  const paths = useMemo(
    () => slices.map((slice, index) => ({
      slice,
      index,
      d: sectorPath(CX, CY, RADIUS, index * step, (index + 1) * step),
      mid: index * step + step / 2,
    })),
    [slices, step],
  );

  useEffect(() => {
    if (targetIndex === null || slices.length === 0) return;
    const mid = targetIndex * step + step / 2;
    turnsRef.current += reducedMotion ? 0 : 4;
    // Final rotation lands the winning sector under the top pointer.
    setRotation(360 * turnsRef.current - mid);
  }, [spinKey, targetIndex, step, slices.length, reducedMotion]);

  return (
    <div className="relative mx-auto w-full max-w-[340px] select-none">
      <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1" aria-hidden="true">
        <svg width="30" height="42" viewBox="0 0 30 42">
          <path d="M15 40 L3 13 A12 12 0 0 1 27 13 Z" fill="#d9b95c" stroke="#4a3a18" strokeWidth="1.5" />
          <circle cx="15" cy="11" r="4" fill="#4a3a18" />
        </svg>
      </div>
      <svg viewBox={"0 0 " + SIZE + " " + SIZE} className="w-full drop-shadow-[0_10px_35px_rgba(0,0,0,0.55)]" role="img" aria-label="命运转盘">
        <defs>
          <radialGradient id="wheel-hub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a2116" />
            <stop offset="100%" stopColor="#110d09" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={RADIUS + 8} fill="#0d0b08" stroke="#c9a227" strokeWidth="2" />
        <g
          style={{
            transform: "rotate(" + rotation + "deg)",
            transformOrigin: CX + "px " + CY + "px",
            transition: reducedMotion ? "none" : "transform 3200ms cubic-bezier(0.15, 0.85, 0.06, 1)",
          }}
        >
          {paths.map(({ slice, index, d, mid }) => {
            const labelPoint = polar(CX, CY, RADIUS * 0.66, mid);
            const flip = mid > 180;
            return (
              <g key={slice.id}>
                <path d={d} fill={colorFor(slice, index)} stroke="#0d0b08" strokeWidth="1.2" />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  fill="#160f08"
                  fontSize={slices.length > 14 ? 8 : 10}
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={"rotate(" + mid + " " + labelPoint.x + " " + labelPoint.y + ")" + (flip ? " rotate(180 " + labelPoint.x + " " + labelPoint.y + ")" : "")}
                >
                  {slice.label.length > 9 ? slice.label.slice(0, 8) + "…" : slice.label}
                </text>
              </g>
            );
          })}
        </g>
        <circle cx={CX} cy={CY} r={34} fill="url(#wheel-hub)" stroke="#c9a227" strokeWidth="1.5" />
        <text x={CX} y={CY} fill="#e8d9a8" fontSize="11" textAnchor="middle" dominantBaseline="middle">命运</text>
      </svg>
    </div>
  );
}


