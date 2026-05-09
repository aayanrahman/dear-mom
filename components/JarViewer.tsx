"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import Jar from "./Jar";
import FoldingPaper from "./FoldingPaper";
import { SCENTS, type JarData, type Memory } from "@/lib/jar";

// deterministic pseudo-random so render stays pure
function seeded(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const NOTE_COLORS = [
  { bg: "#fff3d6", ink: "#7a4d18" },
  { bg: "#ffe0e6", ink: "#8b2a4a" },
  { bg: "#fde8c8", ink: "#7d4a14" },
  { bg: "#f3e3f6", ink: "#5d2a73" },
  { bg: "#ffd9c2", ink: "#8a3d18" },
  { bg: "#fff0d4", ink: "#7a4d18" },
];

const SPRING = { type: "spring" as const, stiffness: 260, damping: 24, mass: 0.9 };
const SOFT_SPRING = { type: "spring" as const, stiffness: 180, damping: 22, mass: 1 };

const PAPER_SOUNDS = [
  "/sounds/paper-1.mp3",
  "/sounds/paper-2.mp3",
  "/sounds/paper-3.mp3",
  "/sounds/paper-4.mp3",
  "/sounds/paper-5.mp3",
];

function useJarAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const paperPoolRef = useRef<HTMLAudioElement[] | null>(null);
  const get = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const crinkle = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!paperPoolRef.current) {
      paperPoolRef.current = PAPER_SOUNDS.map((src) => {
        const a = new Audio(src);
        a.preload = "auto";
        a.volume = 0.55;
        return a;
      });
    }
    const pool = paperPoolRef.current;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    // Clone so overlapping plays don't cut each other off.
    const node = pick.cloneNode(true) as HTMLAudioElement;
    node.volume = pick.volume;
    void node.play().catch(() => {});
  }, []);

  const lidPop = useCallback(() => {
    const ctx = get();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t0);
    o.frequency.exponentialRampToValueAtTime(340, t0 + 0.32);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.32, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.48);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.5);
    // a soft puff of air after
    const dur = 0.5;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const tt = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - tt, 3) * 0.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const ng = ctx.createGain();
    ng.gain.value = 0.18;
    src.connect(lp).connect(ng).connect(ctx.destination);
    src.start(t0 + 0.05);
  }, [get]);

  const sparkleChime = useCallback(() => {
    const ctx = get();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [1320, 1760, 2640].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + i * 0.04);
      g.gain.linearRampToValueAtTime(0.08, t0 + i * 0.04 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.04 + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.04);
      o.stop(t0 + i * 0.04 + 0.65);
    });
  }, [get]);

  return { crinkle, lidPop, sparkleChime };
}

type Drift = {
  id: number;
  x: number;
  size: number;
  delay: number;
  kind: "heart" | "star";
  tint: string;
  dur: number;
};

export default function JarViewer({
  data,
  shareUrl,
}: {
  data: JarData;
  shareUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [showFinal, setShowFinal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(0);
  const audio = useJarAudio();
  const jarControls = useAnimationControls();

  const scent = SCENTS[data.s];
  const allRevealed = data.n.length > 0 && revealed.length === data.n.length;

  // floating note positions (loose orbit around jar) — deterministic
  const orbits = useMemo(() => {
    const rand = seeded(data.n.length * 31 + 7);
    return data.n.map((_, i) => {
      const total = data.n.length;
      const angle = (i / total) * Math.PI * 2 + Math.PI;
      const r = 36 + (i % 3) * 4;
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * (r * 0.55) - 8,
        rot: (rand() - 0.5) * 18,
        bobDur: 3 + (i % 4) * 0.7,
        bobDelay: i * 0.25,
      };
    });
  }, [data.n]);

  // ambient drifting hearts + stars
  const [drifts, setDrifts] = useState<Drift[]>([]);
  useEffect(() => {
    let id = 0;
    const tints = [scent.accent, "#f4c4d3", "#f4d8a8", "#d8c1ee"];
    const spawn = () => {
      setDrifts((prev) => {
        const next = [
          ...prev.slice(-22),
          {
            id: id++,
            x: Math.random() * 100,
            size: 8 + Math.random() * 14,
            delay: 0,
            kind: Math.random() < 0.5 ? "heart" : "star",
            tint: tints[Math.floor(Math.random() * tints.length)],
            dur: 14 + Math.random() * 8,
          } as Drift,
        ];
        return next;
      });
    };
    const t = setInterval(spawn, 700);
    spawn();
    return () => clearInterval(t);
  }, [scent.accent]);

  useEffect(() => {
    if (allRevealed && !showFinal && open) {
      const t = setTimeout(() => setShowFinal(true), 900);
      return () => clearTimeout(t);
    }
  }, [allRevealed, showFinal, open]);

  function openJar() {
    if (open) return;
    setOpen(true);
    audio.lidPop();
    audio.sparkleChime();
    setBurst((b) => b + 1);
    jarControls.start({
      y: [0, -10, 4, 0],
      rotate: [0, -1.5, 1, 0],
      transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
    });
  }

  function pickNote(i: number) {
    if (revealed.includes(i) || active !== null) return;
    audio.crinkle();
    setActive(i);
  }

  function closeNote() {
    if (active === null) return;
    if (!revealed.includes(active)) setRevealed((p) => [...p, active]);
    setActive(null);
  }

  function reseal() {
    if (!open) return;
    // Mirror the open animation in reverse: dismiss the final-message
    // overlay first, then physically drop the lid back onto the jar with
    // a soft wobble at landing. We don't use the descending sealState —
    // that's the cinematic first-seal beat. This is just the reverse of
    // openJar.
    setShowFinal(false);
    window.setTimeout(() => {
      audio.lidPop();
      setOpen(false);
      jarControls.start({
        y: [0, 0, -6, 3, 0],
        rotate: [0, 0, -1.2, 0.6, 0],
        transition: {
          duration: 1.05,
          times: [0, 0.78, 0.86, 0.94, 1],
          ease: [0.22, 1, 0.36, 1],
        },
      });
    }, 700);
    window.setTimeout(() => {
      setRevealed([]);
      setActive(null);
    }, 1900);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <main
      className="flex-1 w-full relative overflow-hidden min-h-screen"
      style={{
        background: scent.bg,
        color: scent.text,
      }}
    >
      {/* deeper dusk overlay for cinematic feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 110%, rgba(78, 28, 60, 0.55) 0%, rgba(78, 28, 60, 0) 55%)," +
            "radial-gradient(80% 60% at 50% -10%, rgba(255, 220, 180, 0.35) 0%, rgba(255, 220, 180, 0) 60%)",
        }}
      />

      {/* animated bokeh */}
      <Bokeh accent={scent.accent} />

      {/* drifting hearts/stars */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {drifts.map((d) => (
          <Floater key={d.id} drift={d} />
        ))}
      </div>

      {/* starfield */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 18% 22%, rgba(255,255,255,0.9), transparent 60%)," +
            "radial-gradient(1.5px 1.5px at 78% 16%, rgba(255,255,255,0.8), transparent 60%)," +
            "radial-gradient(1px 1px at 38% 78%, rgba(255,255,255,0.7), transparent 60%)," +
            "radial-gradient(1.5px 1.5px at 88% 60%, rgba(255,255,255,0.85), transparent 60%)," +
            "radial-gradient(1px 1px at 12% 60%, rgba(255,255,255,0.6), transparent 60%)," +
            "radial-gradient(2px 2px at 62% 38%, rgba(255,255,255,0.6), transparent 60%)," +
            "radial-gradient(2px 2px at 28% 8%, rgba(255,255,255,0.85), transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 py-10 lg:py-14 min-h-screen flex flex-col">
        <header className="text-center mb-4">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SOFT_SPRING}
            className="font-script text-4xl lg:text-5xl"
            style={{ color: scent.accent }}
          >
            For {data.m}
          </motion.p>
          {!open && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ delay: 0.3 }}
              className="font-display italic mt-2 text-base lg:text-lg"
            >
              someone made this jar just for you
            </motion.p>
          )}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* glowing aura behind jar */}
          <motion.div
            aria-hidden
            animate={{
              scale: open ? [1, 1.4, 1.2] : [1, 1.08, 1],
              opacity: open ? [0.7, 1, 0.85] : [0.5, 0.7, 0.5],
            }}
            transition={{
              duration: open ? 1.2 : 4,
              repeat: open ? 0 : Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
            className="absolute pointer-events-none"
            style={{
              width: 520,
              height: 520,
              background: `radial-gradient(circle, ${scent.accent}55 0%, ${scent.accent}11 45%, transparent 70%)`,
              filter: "blur(20px)",
            }}
          />

          {/* idle bounce wrapper, then settle on open */}
          <motion.div
            animate={
              open
                ? { scale: 0.82, y: 30 }
                : { scale: [1, 1.02, 1], y: [0, -6, 0] }
            }
            transition={
              open
                ? { ...SOFT_SPRING, duration: 0.9 }
                : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
            }
            className="relative"
          >
            <motion.div animate={jarControls} style={{ filter: `drop-shadow(0 24px 48px ${scent.accent}55)` }}>
              <Jar
                momName={data.m}
                ribbon={data.r}
                scentLabel={scent.label}
                notesPreview={open ? [] : data.n}
                open={open}
                className="w-72 lg:w-96"
              />
            </motion.div>
          </motion.div>

          {/* tap to open button with pulsing ring */}
          {!open && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative mt-8"
            >
              <motion.span
                aria-hidden
                animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: `0 0 0 3px ${scent.accent}88` }}
              />
              <motion.button
                type="button"
                onClick={openJar}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                className="relative rounded-full px-9 py-5 text-lg font-semibold text-white shadow-xl"
                style={{
                  background: scent.accent,
                  boxShadow: `0 16px 40px ${scent.accent}88, 0 0 24px ${scent.accent}55`,
                }}
              >
                untie the ribbon →
              </motion.button>
            </motion.div>
          )}

          {open && !showFinal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-4 text-center max-w-md"
            >
              <p className="font-display italic text-lg lg:text-xl">
                {revealed.length === 0
                  ? "tap a note to read it"
                  : allRevealed
                    ? "you found them all…"
                    : `${revealed.length} of ${data.n.length} read`}
              </p>
            </motion.div>
          )}
        </div>

        {/* sparkle burst at lid */}
        <SparkleBurst trigger={burst} accent={scent.accent} />

        {/* floating crumpled notes around jar */}
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 pointer-events-none">
              {data.n.map((_, i) => {
                if (revealed.includes(i) || active === i) return null;
                const o = orbits[i];
                const col = NOTE_COLORS[i % NOTE_COLORS.length];
                return (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => pickNote(i)}
                    initial={{
                      opacity: 0,
                      scale: 0.2,
                      x: 0,
                      y: 60,
                      rotate: 0,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      x: `${o.x}vw`,
                      y: `${o.y}vh`,
                      rotate: o.rot,
                    }}
                    exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.25 } }}
                    transition={{
                      ...SPRING,
                      delay: 0.7 + i * 0.18,
                    }}
                    whileHover={{ scale: 1.18, rotate: 0, y: `${o.y - 1}vh` }}
                    whileTap={{ scale: 0.92 }}
                    aria-label={`Open note ${i + 1}`}
                    className="absolute pointer-events-auto cursor-pointer"
                    style={{
                      left: "50%",
                      top: "50%",
                      width: "min(64px, 14vw)",
                      height: "min(84px, 18vw)",
                      marginLeft: "min(-32px, -7vw)",
                      marginTop: "min(-42px, -9vw)",
                    }}
                  >
                    <CrumpledNote color={col.bg} bobDur={o.bobDur} bobDelay={o.bobDelay} />
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* unfold reader */}
        <AnimatePresence>
          {active !== null && (
            <NoteReader
              key={active}
              memory={data.n[active]}
              color={NOTE_COLORS[active % NOTE_COLORS.length]}
              onClose={closeNote}
              onFoldStart={audio.crinkle}
              accent={scent.accent}
            />
          )}
        </AnimatePresence>

        {/* final message */}
        <AnimatePresence>
          {showFinal && (
            <FinalMessage
              momName={data.m}
              fromName={data.f}
              accent={scent.accent}
              text={scent.text}
              bg={scent.bg}
              onReseal={reseal}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 mt-10 flex flex-col sm:flex-row gap-3 justify-center text-sm">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full px-5 py-3 bg-white/70 hover:bg-white transition font-medium shadow"
          >
            {copied ? "link copied ✓" : "copy this jar's link"}
          </button>
          <Link
            href="/"
            className="rounded-full px-5 py-3 bg-white/40 hover:bg-white/70 transition text-center font-medium"
          >
            make one for your mom
          </Link>
        </div>
      </div>
    </main>
  );
}

function Bokeh({ accent }: { accent: string }) {
  const blobs = [
    { size: 380, x: 12, y: 18, dur: 18, tint: accent, op: 0.18 },
    { size: 460, x: 78, y: 28, dur: 22, tint: "#f4c4d3", op: 0.18 },
    { size: 320, x: 22, y: 78, dur: 26, tint: "#f6dca7", op: 0.16 },
    { size: 420, x: 82, y: 76, dur: 20, tint: "#d6c2eb", op: 0.18 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          animate={{
            x: [0, 24, -18, 0],
            y: [0, -22, 16, 0],
            scale: [1, 1.12, 0.95, 1],
          }}
          transition={{
            duration: b.dur,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.x}%`,
            top: `${b.y}%`,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${b.tint} 0%, transparent 65%)`,
            opacity: b.op,
            filter: "blur(40px)",
          }}
        />
      ))}
    </div>
  );
}

function Floater({ drift }: { drift: Drift }) {
  return (
    <motion.div
      initial={{ y: "108vh", opacity: 0, rotate: -10 }}
      animate={{ y: "-15vh", opacity: [0, 0.7, 0.7, 0], rotate: 14 }}
      transition={{
        duration: drift.dur,
        ease: "linear",
        times: [0, 0.15, 0.85, 1],
      }}
      className="absolute"
      style={{
        left: `${drift.x}%`,
        width: drift.size,
        height: drift.size,
        color: drift.tint,
        filter: `drop-shadow(0 0 6px ${drift.tint})`,
      }}
    >
      {drift.kind === "heart" ? (
        <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
          <path d="M12 21s-7-4.5-9.5-9C0.5 8 3 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4 23.5 8 21.5 12 19 16.5 12 21 12 21z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
          <path d="M12 2 L14.5 9 L22 9.5 L16 14 L18 22 L12 17.5 L6 22 L8 14 L2 9.5 L9.5 9 Z" />
        </svg>
      )}
    </motion.div>
  );
}

function CrumpledNote({
  color,
  bobDur,
  bobDelay,
}: {
  color: string;
  bobDur: number;
  bobDelay: number;
}) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
      transition={{
        duration: bobDur,
        delay: bobDelay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="relative w-full h-full"
      style={{
        background: color,
        borderRadius: 4,
        boxShadow:
          "0 10px 24px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(120,80,40,0.10)",
      }}
    >
      {/* horizontal fold creases — top third + bottom third, like a trifold letter */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 4%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.06) 33.5%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.06) 66.5%, rgba(0,0,0,0) 68%, rgba(0,0,0,0) 96%, rgba(0,0,0,0.10) 100%)",
        }}
      />
      {/* faint ruled lines so it reads as paper */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          background:
            "repeating-linear-gradient(0deg, transparent 0 8px, rgba(160,120,70,0.06) 8px 9px)",
        }}
      />
    </motion.div>
  );
}

/**
 * NoteReader — folded letter sitting on a darkened backdrop. After it
 * springs into view it unfolds (bottom flap first, then top), revealing
 * the prompt + handwritten answer in the middle panel. "Fold back up"
 * reverses the fold and then dismisses the modal.
 */
function NoteReader({
  memory,
  color,
  onClose,
  onFoldStart,
  accent,
}: {
  memory: Memory;
  color: { bg: string; ink: string };
  onClose: () => void;
  onFoldStart?: () => void;
  accent: string;
}) {
  const [prompt, text] = memory;
  const [fold, setFold] = useState<"folded" | "flat">("folded");
  const [closing, setClosing] = useState(false);
  const [size, setSize] = useState({ w: 360, h: 470 });

  useEffect(() => {
    // Wait for the modal to finish springing in, then unfold.
    const t = window.setTimeout(() => setFold("flat"), 320);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Leave generous side gutters on phones so the paper never reaches the edge.
      const w = Math.min(vw - 48, 360);
      const h = Math.min(vh * 0.78, w * (470 / 360));
      setSize({ w, h });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const closeNote = () => {
    if (closing) return;
    onFoldStart?.();
    setClosing(true);
    setFold("folded");
    // Once the fold animation lands, dismiss.
    window.setTimeout(onClose, 1100);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: "rgba(40, 14, 35, 0.55)",
        backdropFilter: "blur(8px)",
      }}
      onClick={closeNote}
    >
      <motion.div
        initial={{ scale: 0.5, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0, transition: { duration: 0.3 } }}
        transition={{ ...SOFT_SPRING, duration: 0.6 }}
        onClick={(e) => e.stopPropagation()}
        className="relative"
        style={{
          width: size.w,
          height: size.h,
          perspective: 1400,
        }}
      >
        <FoldingPaper
          width={size.w}
          height={size.h}
          prompt={prompt}
          text={text}
          ink={color.ink}
          color={color.bg}
          state={fold}
          duration={0.95}
          stagger={0.22}
        />

        {fold === "flat" && !closing && (
          <motion.button
            type="button"
            onClick={closeNote}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="absolute -bottom-14 left-1/2 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-medium text-white shadow"
            style={{ background: accent }}
          >
            fold back up ↩
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

function SparkleBurst({ trigger, accent }: { trigger: number; accent: string }) {
  const bursts = useMemo(() => {
    if (!trigger) return [] as { id: number; angle: number; dist: number; size: number }[];
    const rand = seeded(trigger * 41);
    return Array.from({ length: 22 }, (_, i) => ({
      id: trigger * 100 + i,
      angle: (Math.PI * 2 * i) / 22 + (rand() - 0.5) * 0.5,
      dist: 80 + rand() * 140,
      size: 4 + rand() * 8,
    }));
  }, [trigger]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-hidden>
      <div className="absolute left-1/2 top-1/2">
        {bursts.map((s) => (
          <motion.span
            key={s.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
              x: Math.cos(s.angle) * s.dist,
              y: Math.sin(s.angle) * s.dist - 30,
              opacity: 0,
              scale: 1.4,
            }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute rounded-full"
            style={{
              width: s.size,
              height: s.size,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              background: accent,
              boxShadow: `0 0 12px ${accent}, 0 0 28px ${accent}cc`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FinalMessage({
  momName,
  fromName,
  accent,
  text,
  bg,
  onReseal,
}: {
  momName: string;
  fromName: string;
  accent: string;
  text: string;
  bg: string;
  onReseal: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: bg }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(60% 50% at 50% 50%, ${accent}33, transparent 70%)`,
        }}
      />
      <motion.div
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ ...SOFT_SPRING, duration: 1 }}
        className="relative text-center max-w-xl"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ...SOFT_SPRING }}
          className="font-script text-5xl lg:text-7xl leading-tight"
          style={{ color: accent }}
        >
          I love you,
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, ...SOFT_SPRING }}
          className="font-script text-5xl lg:text-7xl mt-2"
          style={{ color: accent }}
        >
          {momName}
        </motion.p>
        {fromName && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.9 }}
            className="font-display italic text-xl lg:text-2xl mt-8"
            style={{ color: text }}
          >
            — {fromName}
          </motion.p>
        )}
        <motion.button
          type="button"
          onClick={onReseal}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-12 rounded-full px-7 py-3 text-sm font-medium text-white shadow"
          style={{ background: accent }}
        >
          seal it back ↻
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
