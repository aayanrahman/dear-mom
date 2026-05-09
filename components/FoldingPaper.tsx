"use client";

/**
 * FoldingPaper — a CSS 3D trifold letter.
 *
 * Inspired by the page-flip CSS technique (preserve-3d + nested rotations).
 * Three panels stacked vertically: top flap, middle, bottom flap.
 * Each flap pivots around its seam with the middle. To fold the letter we
 * rotate the top flap forward over the middle (rotateX -180, origin bottom)
 * and the bottom flap up over both (rotateX 180, origin top).
 *
 * The midpoint of each rotation also lifts the flap slightly toward the
 * viewer (translateZ ~22px) so the fold has a bit of paper-bulge instead
 * of looking like a perfectly rigid hinge.
 *
 * The middle panel is where the prompt + text live. When folded, both
 * flaps cover the middle and the content is hidden behind paper.
 *
 * Pass `state="flat"` to render unfolded, `state="folded"` to render the
 * closed letter. Toggling between them animates the fold/unfold; the
 * mount-time render uses `initial` to skip the entry animation, so a
 * letter that mounts already-folded just appears folded.
 */

import { motion, useAnimationControls } from "motion/react";
import { useEffect, useRef } from "react";

export type FoldState = "flat" | "folded";

type Props = {
  width: number;
  height: number;
  /** paper face color */
  color?: string;
  /** the prompt the writer answered (small italic header) */
  prompt?: string;
  /** the answer (handwritten script) */
  text?: string;
  /** ink color for content */
  ink?: string;
  /** signature shown at the bottom of the unfolded middle panel */
  signature?: string;
  /** controls the fold direction */
  state: FoldState;
  /** seconds for one flap rotation */
  duration?: number;
  /** seconds offset between top and bottom flaps */
  stagger?: number;
  /** fired once both flaps reach their target state */
  onSettled?: () => void;
  /** scale the prompt + text proportionally for thumbnails */
  contentScale?: number;
};

export default function FoldingPaper({
  width,
  height,
  color = "#fdf6e3",
  prompt,
  text,
  ink = "#5a3a14",
  signature,
  state,
  duration = 0.85,
  stagger = 0.18,
  onSettled,
  contentScale = 1,
}: Props) {
  const flapH = height / 3;
  const folded = state === "folded";

  // Controls per flap so we can fire keyframed animations imperatively
  // when state changes — without animating on initial mount.
  const topCtrl = useAnimationControls();
  const bottomCtrl = useAnimationControls();
  // Initialised with the mounting state so the first effect run is a no-op.
  const lastState = useRef<FoldState>(state);

  useEffect(() => {
    if (lastState.current === state) return;
    lastState.current = state;

    const ease: [number, number, number, number] = [0.55, 0, 0.35, 1];
    const times = [0, 0.5, 1];

    if (folded) {
      // Folding: top flap closes first, then bottom flap on top of it.
      void topCtrl.start({
        rotateX: [0, -94, -180],
        z: [0, 22, 2],
        transition: { duration, times, ease },
      });
      void bottomCtrl.start({
        rotateX: [0, 94, 180],
        z: [0, 24, 6],
        transition: { duration, times, ease, delay: stagger },
      });
      // settled when bottom finishes
      const settle = window.setTimeout(
        () => onSettled?.(),
        (duration + stagger) * 1000 + 30,
      );
      return () => window.clearTimeout(settle);
    } else {
      // Unfolding: bottom flap opens first (it's the topmost layer),
      // then top flap reveals the middle.
      void bottomCtrl.start({
        rotateX: [180, 94, 0],
        z: [6, 24, 0],
        transition: { duration, times, ease },
      });
      void topCtrl.start({
        rotateX: [-180, -94, 0],
        z: [2, 22, 0],
        transition: { duration, times, ease, delay: stagger },
      });
      const settle = window.setTimeout(
        () => onSettled?.(),
        (duration + stagger) * 1000 + 30,
      );
      return () => window.clearTimeout(settle);
    }
  }, [state, folded, duration, stagger, topCtrl, bottomCtrl, onSettled]);

  // Common paper finish — subtle ruled lines + warm vignette.
  const paperBg =
    `repeating-linear-gradient(0deg, transparent 0 22px, rgba(160,120,70,0.05) 22px 23px),` +
    `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 60%, rgba(120,80,40,0.08) 100%),` +
    color;

  const flapBase: React.CSSProperties = {
    position: "absolute",
    left: 0,
    width: "100%",
    height: flapH,
    background: paperBg,
    boxShadow:
      "inset 0 0 0 1px rgba(120,80,40,0.10), 0 4px 12px rgba(0,0,0,0.10)",
    backfaceVisibility: "visible",
    willChange: "transform",
  };

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        transformStyle: "preserve-3d",
      }}
    >
      {/* MIDDLE — content lives here. */}
      <div
        style={{
          ...flapBase,
          top: flapH,
          boxShadow:
            "inset 0 0 0 1px rgba(120,80,40,0.10), 0 14px 32px rgba(0,0,0,0.18)",
        }}
      >
        <motion.div
          // Content fades to 0 when folding (just as the flaps start to
          // cover it) and back to 1 when unfolding (after the flaps
          // mostly clear the middle). Tied to `state` so it syncs with
          // the flap rotations.
          animate={{ opacity: folded ? 0 : 1 }}
          transition={
            folded
              ? { duration: 0.22, delay: 0.08 }
              : { duration: 0.35, delay: duration * 0.65 }
          }
          style={{
            position: "absolute",
            inset: 0,
            padding: `${18 * contentScale}px ${22 * contentScale}px`,
            color: ink,
            display: "flex",
            flexDirection: "column",
            transform: "translateZ(0.1px)", // peel above the panel surface
          }}
        >
          {prompt && (
            <p
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontStyle: "italic",
                fontSize: 13 * contentScale,
                opacity: 0.55,
                marginBottom: 8 * contentScale,
                letterSpacing: "0.02em",
              }}
            >
              {prompt}
            </p>
          )}
          {text && (
            <p
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: 26 * contentScale,
                lineHeight: 1.18,
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {text}
            </p>
          )}
          {signature && (
            <p
              style={{
                marginTop: "auto",
                fontFamily: "var(--font-caveat), cursive",
                fontSize: 22 * contentScale,
                opacity: 0.7,
                textAlign: "right",
              }}
            >
              — {signature}
            </p>
          )}
        </motion.div>
      </div>

      {/* TOP FLAP — pivots around its bottom edge. */}
      <motion.div
        initial={{ rotateX: folded ? -180 : 0, z: folded ? 2 : 0 }}
        animate={topCtrl}
        style={{
          ...flapBase,
          top: 0,
          transformOrigin: "50% 100%",
          transformStyle: "preserve-3d",
        }}
      >
        {/* slight crease shading at the seam side */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(0,0,0,0.10) 100%)",
            pointerEvents: "none",
          }}
        />
      </motion.div>

      {/* BOTTOM FLAP — pivots around its top edge, sits on top in z when folded. */}
      <motion.div
        initial={{ rotateX: folded ? 180 : 0, z: folded ? 6 : 0 }}
        animate={bottomCtrl}
        style={{
          ...flapBase,
          bottom: 0,
          transformOrigin: "50% 0%",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(0,0,0,0) 70%, rgba(0,0,0,0.10) 100%)",
            pointerEvents: "none",
          }}
        />
      </motion.div>
    </div>
  );
}
