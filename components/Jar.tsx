"use client";

import { motion } from "motion/react";
import { RIBBONS, type Ribbon } from "@/lib/jar";

type Props = {
  momName: string;
  ribbon: Ribbon;
  scentLabel: string;
  className?: string;
  open?: boolean;
  /** count or list — only the length matters for the rendered squares */
  notesPreview?: unknown[];
  /**
   * Sealing choreography:
   *   "missing"    — no lid yet (jar is open, never sealed)
   *   "idle"       — lid in place; obeys `open` prop for opening
   *   "descending" — lid drops in from above with a thud
   */
  sealState?: "missing" | "idle" | "descending";
};

export default function Jar({
  momName,
  ribbon,
  scentLabel,
  className,
  open = false,
  notesPreview = [],
  sealState = "idle",
}: Props) {
  const r = RIBBONS[ribbon];
  const safeName = (momName || "Mom").trim() || "Mom";
  const labelName =
    safeName.length > 18 ? safeName.slice(0, 17) + "…" : safeName;

  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <svg
        viewBox="0 0 240 320"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="glassBody" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fff8e8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f3e3c1" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="lid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d8b271" />
            <stop offset="50%" stopColor="#b8884a" />
            <stop offset="100%" stopColor="#8c5f2d" />
          </linearGradient>
          <radialGradient id="lidShine" cx="0.4" cy="0.3" r="0.5">
            <stop offset="0%" stopColor="#ffeac2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ribbon" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={r.color} />
            <stop offset="100%" stopColor={r.shadow} />
          </linearGradient>
        </defs>

        {/* shadow under jar */}
        <ellipse cx="120" cy="305" rx="80" ry="8" fill="rgba(0,0,0,0.18)" />

        {/* jar body */}
        <path
          d="M 50 110 Q 50 100 60 100 L 180 100 Q 190 100 190 110 L 190 280 Q 190 300 170 300 L 70 300 Q 50 300 50 280 Z"
          fill="url(#glassBody)"
          stroke="rgba(120, 80, 40, 0.25)"
          strokeWidth="1.5"
        />
        <path
          d="M 60 115 L 60 280 Q 60 290 70 290"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* notes inside jar (visible when not open) */}
        {!open &&
          notesPreview.slice(0, 6).map((_, i) => {
            const colors = ["#fff3d6", "#ffe9d3", "#fde6e6", "#ecf3e3", "#e9eef7"];
            const c = colors[i % colors.length];
            const x = 65 + (i * 22) % 100;
            const y = 200 + Math.floor(i / 3) * 30;
            const rot = i % 2 === 0 ? -8 : 12;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width="34"
                height="34"
                rx="2"
                fill={c}
                stroke="rgba(120,80,40,0.2)"
                strokeWidth="0.8"
                transform={`rotate(${rot} ${x + 17} ${y + 17})`}
              />
            );
          })}

        {/* label */}
        <g>
          <rect
            x="68"
            y="155"
            width="104"
            height="62"
            rx="3"
            fill="#fdf6e3"
            stroke="rgba(120,80,40,0.35)"
            strokeWidth="1.2"
          />
          <rect
            x="72"
            y="159"
            width="96"
            height="54"
            rx="2"
            fill="none"
            stroke="rgba(120,80,40,0.25)"
            strokeDasharray="2 2"
          />
          <text
            x="120"
            y="178"
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--font-fraunces), Georgia, serif"
            fontStyle="italic"
            fill="#8a5a2c"
            letterSpacing="2"
          >
            FOR
          </text>
          <text
            x="120"
            y="200"
            textAnchor="middle"
            fontSize="20"
            fontFamily="var(--font-caveat), cursive"
            fontWeight="600"
            fill="#5a3a14"
          >
            {labelName}
          </text>
        </g>

        {/* lid: slides up when open, or drops in from above when sealing,
            or hidden entirely when the jar hasn't been sealed yet */}
        <motion.g
          initial={false}
          animate={
            sealState === "descending"
              ? {
                  // Mirror the reverse of the open animation: lid starts
                  // a visible height above the jar (matching open's
                  // y:-120 lift), holds briefly, descends, overshoots
                  // slightly, settles. Opacity stays 1 throughout so the
                  // lid is physically seen the whole way down instead of
                  // fading in mid-air.
                  y: [-120, -120, 14, -5, 0],
                  rotate: [-8, -8, 4, -1, 0],
                  opacity: 1,
                }
              : sealState === "missing"
                ? { y: -320, opacity: 0 }
                : {
                    y: open ? -120 : 0,
                    opacity: open ? 0 : 1,
                    rotate: open ? -8 : 0,
                  }
          }
          transition={
            sealState === "descending"
              ? {
                  duration: 1.25,
                  times: [0, 0.15, 0.7, 0.85, 1],
                  ease: [0.45, 0, 0.55, 1],
                }
              : sealState === "missing"
                ? { duration: 0 }
                : {
                    y: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                    rotate: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                    // On open, fade the lid out late (after it's lifted out
                    // of frame). On close, fade it in fast at the start so
                    // the lid is visible the whole way down — otherwise it
                    // looks like the lid teleports into place.
                    opacity: open
                      ? { duration: 0.45, delay: 0.5, ease: "easeOut" }
                      : { duration: 0.18, ease: "easeOut" },
                  }
          }
          style={{ transformOrigin: "120px 80px" }}
        >
          <rect x="48" y="78" width="144" height="32" rx="6" fill="url(#lid)" />
          <rect x="48" y="78" width="144" height="10" rx="4" fill="url(#lidShine)" />
          <rect x="48" y="98" width="144" height="2" rx="1" fill="rgba(0,0,0,0.2)" />
          <text
            x="120"
            y="98"
            textAnchor="middle"
            fontSize="7"
            fontFamily="var(--font-fraunces), Georgia, serif"
            fontStyle="italic"
            fill="#fff3d6"
            letterSpacing="3"
          >
            {scentLabel.toUpperCase()}
          </text>
        </motion.g>

        {/* ribbon (unties when open) */}
        <motion.g
          initial={false}
          animate={{
            opacity: open ? 0 : 1,
            y: open ? 14 : 0,
            scale: open ? 0.9 : 1,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ transformOrigin: "120px 130px" }}
        >
          {/* ribbon band */}
          <rect x="48" y="120" width="144" height="14" fill="url(#ribbon)" />
          {/* bow center */}
          <circle cx="120" cy="127" r="6" fill={r.shadow} />
          {/* bow loops */}
          <path
            d="M 120 127 Q 102 112 92 122 Q 88 130 100 134 Q 112 134 120 127 Z"
            fill="url(#ribbon)"
            stroke={r.shadow}
            strokeWidth="0.8"
          />
          <path
            d="M 120 127 Q 138 112 148 122 Q 152 130 140 134 Q 128 134 120 127 Z"
            fill="url(#ribbon)"
            stroke={r.shadow}
            strokeWidth="0.8"
          />
          {/* ribbon tails */}
          <path
            d="M 117 132 Q 110 148 105 158 L 112 159 Q 118 148 121 134 Z"
            fill="url(#ribbon)"
          />
          <path
            d="M 123 132 Q 130 148 135 158 L 128 159 Q 122 148 119 134 Z"
            fill="url(#ribbon)"
          />
        </motion.g>

        {/* glass shine on top of everything */}
        <path
          d="M 60 115 Q 60 105 70 105 L 90 105 Q 80 110 78 130 L 78 270"
          fill="none"
          stroke="url(#glass)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}
