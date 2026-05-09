"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import Jar from "@/components/Jar";
import FoldingPaper from "@/components/FoldingPaper";
import {
  encodeJar,
  RIBBONS,
  SCENTS,
  type JarData,
  type Memory,
  type Ribbon,
  type Scent,
} from "@/lib/jar";

type Step = "intro" | "name" | "from" | "scent" | "ribbon" | "memory" | "review";

const ORDER: Step[] = [
  "intro",
  "name",
  "from",
  "scent",
  "ribbon",
  "memory",
  "review",
];

const PROMPTS = [
  "what's something she does that always makes you smile?",
  "a small thing she taught you, without meaning to.",
  "a moment with her you'd want to live again.",
  "something you've never thanked her for.",
  "a phrase only she says.",
  "a smell, a meal, a song that is just her.",
  "what does she do when no one's watching?",
  "a memory that still makes you laugh.",
  "the way she shows love without saying it.",
  "what you miss when you're away from her.",
  "something she does that you do too, now.",
  "the bravest thing you've seen her do.",
];

const SPRING = { type: "spring" as const, stiffness: 280, damping: 26, mass: 0.9 };

// ---------- audio: just two tiny synthesized sfx ----------
function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const get = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctxRef.current = new C();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);
  const crinkle = useCallback(() => {
    const ctx = get();
    if (!ctx) return;
    const dur = 0.5;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - t, 2.0) +
        (Math.random() < 0.025 ? (Math.random() - 0.5) * 0.7 * (1 - t) : 0);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2800 + Math.random() * 1400;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = 0.28;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }, [get]);
  const thud = useCallback(() => {
    const ctx = get();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(220, t0);
    o.frequency.exponentialRampToValueAtTime(60, t0 + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.6);
    // glassy ring
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 1100;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t0 + 0.04);
    g2.gain.linearRampToValueAtTime(0.12, t0 + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    o2.connect(g2).connect(ctx.destination);
    o2.start(t0 + 0.04);
    o2.stop(t0 + 0.6);
  }, [get]);
  return { crinkle, thud };
}

// ---------- types ----------
type FlyingNote = {
  id: number;
  memory: Memory;
  bg: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

// Single warm cream for every note in the jar — keeps the create flow
// visually calm and consistent.
const PAPER_COLOR = "#fdf6e3";

// ---------- main ----------
export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [momName, setMomName] = useState("");
  const [fromName, setFromName] = useState("");
  const [ribbon, setRibbon] = useState<Ribbon>("blush");
  const [scent, setScent] = useState<Scent>("rose");
  const [notes, setNotes] = useState<Memory[]>([]);
  const [draft, setDraft] = useState("");
  const [flying, setFlying] = useState<FlyingNote | null>(null);
  const [sealing, setSealing] = useState(false);

  const draftCardRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<HTMLDivElement>(null);
  const jarControls = useAnimationControls();
  const landedIds = useRef<Set<number>>(new Set());
  const audio = useAudio();

  const scentTheme = SCENTS[scent];
  const stepIndex = ORDER.indexOf(step);
  const promptIndex = notes.length % PROMPTS.length;
  const currentPrompt = PROMPTS[promptIndex];
  const canSeal = momName.trim().length > 0 && notes.length >= 3;

  const previewData: JarData = useMemo(
    () => ({ m: momName || "Mom", f: fromName, r: ribbon, s: scent, n: notes }),
    [momName, fromName, ribbon, scent, notes],
  );

  function go(direction: 1 | -1) {
    const next = ORDER[stepIndex + direction];
    if (next) setStep(next);
  }

  function dropMemory() {
    const text = draft.trim();
    if (!text || flying) return;
    const cardEl = draftCardRef.current;
    const jarEl = jarRef.current;
    if (!cardEl || !jarEl) {
      setNotes((p) => [...p, [currentPrompt, text]]);
      setDraft("");
      return;
    }
    const cb = cardEl.getBoundingClientRect();
    const jb = jarEl.getBoundingClientRect();
    audio.crinkle();
    setFlying({
      id: Date.now() + Math.random(),
      memory: [currentPrompt, text],
      bg: PAPER_COLOR,
      from: { x: cb.left + cb.width / 2, y: cb.top + cb.height / 2 },
      to: { x: jb.left + jb.width / 2, y: jb.top + jb.height * 0.5 },
    });
    setDraft("");
  }

  function onLanded() {
    if (!flying) return;
    if (landedIds.current.has(flying.id)) return;
    landedIds.current.add(flying.id);
    const landed = flying;
    setNotes((p) => [...p, landed.memory]);
    setFlying(null);
    jarControls.start({
      y: [0, -14, 6, -3, 0],
      rotate: [0, -3, 2, -1, 0],
      scale: [1, 1.04, 0.98, 1.01, 1],
      transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
    });
  }

  function startSeal() {
    if (!canSeal || sealing) return;
    setSealing(true);
  }

  // Once the seal animation completes the page navigates to the share view.
  function onSealDone() {
    const slug = encodeJar(previewData);
    router.push(`/jar/${slug}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.shiftKey) return;
      if (step === "name" && momName.trim()) {
        e.preventDefault();
        go(1);
      } else if (step === "from") {
        e.preventDefault();
        go(1);
      } else if (step === "memory" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dropMemory();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, momName, draft, flying, currentPrompt]);

  return (
    <main
      className="flex-1 w-full relative overflow-hidden"
      style={{
        background: scentTheme.bg,
        color: scentTheme.text,
        transition: "background 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Starfield */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.9), transparent 60%)," +
            "radial-gradient(1.5px 1.5px at 75% 18%, rgba(255,255,255,0.7), transparent 60%)," +
            "radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.6), transparent 60%)," +
            "radial-gradient(1.5px 1.5px at 88% 65%, rgba(255,255,255,0.8), transparent 60%)," +
            "radial-gradient(1px 1px at 12% 60%, rgba(255,255,255,0.5), transparent 60%)," +
            "radial-gradient(1px 1px at 60% 50%, rgba(255,255,255,0.5), transparent 60%)," +
            "radial-gradient(2px 2px at 30% 12%, rgba(255,255,255,0.85), transparent 60%)",
          backgroundSize: "100% 100%",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 50% at 50% 100%, ${scentTheme.accent}33, transparent 70%)`,
          transition: "background 0.9s ease",
        }}
      />

      {/* Progress dots */}
      {!sealing && (
        <div className="absolute top-3 sm:top-5 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          {ORDER.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (i < stepIndex) setStep(s);
              }}
              aria-label={`step ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === stepIndex ? 28 : 7,
                background:
                  i <= stepIndex ? scentTheme.accent : "rgba(0,0,0,0.15)",
                cursor: i < stepIndex ? "pointer" : "default",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-5 pt-12 sm:pt-16 lg:pt-24 pb-10 lg:pb-16 min-h-screen flex flex-col-reverse gap-6 lg:gap-14 lg:grid lg:grid-cols-[1.15fr_minmax(280px,400px)] lg:items-center">
        {/* Step content */}
        <section className="relative min-h-[380px] lg:min-h-[460px] flex items-center">
          <AnimatePresence mode="wait">
            {!sealing && (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 40, scale: 0.96, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -32, scale: 0.97, filter: "blur(6px)" }}
                transition={{ ...SPRING, mass: 0.7 }}
                className="w-full"
              >
                {step === "intro" && (
                  <Intro accent={scentTheme.accent} onStart={() => go(1)} />
                )}
                {step === "name" && (
                  <NameStep
                    value={momName}
                    onChange={setMomName}
                    accent={scentTheme.accent}
                    text={scentTheme.text}
                    onBack={() => go(-1)}
                    onNext={() => go(1)}
                  />
                )}
                {step === "from" && (
                  <FromStep
                    value={fromName}
                    onChange={setFromName}
                    accent={scentTheme.accent}
                    text={scentTheme.text}
                    onBack={() => go(-1)}
                    onNext={() => go(1)}
                  />
                )}
                {step === "scent" && (
                  <ScentStep
                    value={scent}
                    onChange={setScent}
                    onBack={() => go(-1)}
                    onNext={() => go(1)}
                    accent={scentTheme.accent}
                  />
                )}
                {step === "ribbon" && (
                  <RibbonStep
                    value={ribbon}
                    onChange={setRibbon}
                    onBack={() => go(-1)}
                    onNext={() => go(1)}
                    accent={scentTheme.accent}
                  />
                )}
                {step === "memory" && (
                  <MemoryStep
                    notes={notes}
                    draft={draft}
                    setDraft={setDraft}
                    flying={flying !== null}
                    promptText={currentPrompt}
                    promptIndex={promptIndex}
                    onDrop={dropMemory}
                    onUndo={() => setNotes((p) => p.slice(0, -1))}
                    onSeal={() => setStep("review")}
                    accent={scentTheme.accent}
                    draftCardRef={draftCardRef}
                  />
                )}
                {step === "review" && (
                  <ReviewStep
                    notes={notes}
                    momName={momName}
                    accent={scentTheme.accent}
                    onBack={() => setStep("memory")}
                    onSeal={startSeal}
                    canSeal={canSeal}
                    sealing={sealing}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Live jar — appears above the step on phones, beside on desktop.
            No lid yet: the lid is placed during the seal ceremony. */}
        <aside className="flex flex-col items-center justify-center lg:justify-end">
          <motion.div
            ref={jarRef}
            animate={sealing ? { opacity: 0, scale: 0.85 } : jarControls}
            transition={
              sealing ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] } : undefined
            }
            className="relative"
            style={{
              filter: `drop-shadow(0 16px 32px ${scentTheme.accent}33)`,
            }}
          >
            <Jar
              momName={previewData.m}
              ribbon={previewData.r}
              scentLabel={scentTheme.label}
              notesPreview={notes}
              sealState="missing"
              className="w-40 sm:w-52 lg:w-72"
            />
            {!sealing && (
              <motion.p
                key={notes.length}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 0.75, y: 0 }}
                className="text-center font-display italic text-sm sm:text-base mt-2 sm:mt-3"
                style={{ color: scentTheme.text }}
              >
                {notes.length === 0
                  ? "an empty jar… waiting for the lid"
                  : `${notes.length} ${notes.length === 1 ? "memory" : "memories"} inside`}
              </motion.p>
            )}
          </motion.div>
        </aside>
      </div>

      {/* Flying trifold paper */}
      <AnimatePresence>
        {flying && (
          <FlyingFold
            key={flying.id}
            note={flying}
            onComplete={onLanded}
          />
        )}
      </AnimatePresence>

      {/* Sealing overlay */}
      <AnimatePresence>
        {sealing && (
          <SealMoment
            momName={momName || "Mom"}
            ribbon={ribbon}
            scent={scent}
            accent={scentTheme.accent}
            text={scentTheme.text}
            bg={scentTheme.bg}
            scentLabel={scentTheme.label}
            noteCount={notes.length}
            onThud={audio.thud}
            onDone={onSealDone}
          />
        )}
      </AnimatePresence>

      {!sealing && (
        <footer className="relative z-10 text-center pb-6 opacity-50 text-xs">
          made with love for mother&rsquo;s day · no accounts, no tracking
        </footer>
      )}
    </main>
  );
}

// =====================================================================
// FlyingFold — renders a real trifold letter that folds itself shut at
// the textarea, then arcs into the jar.
// Phase 1: hold position, fold (top flap → bottom flap, staggered).
// Phase 2: arc to jar with scale-down + tumble.
// =====================================================================
const PAPER_W = 220;
const PAPER_H = 300;

function FlyingFold({
  note,
  onComplete,
}: {
  note: FlyingNote;
  onComplete: () => void;
}) {
  const [foldState, setFoldState] = useState<"flat" | "folded">("flat");
  const [phase, setPhase] = useState<"folding" | "flying">("folding");
  const [prompt, text] = note.memory;

  useEffect(() => {
    // tiny delay so the user perceives the paper at rest before folding
    const t1 = window.setTimeout(() => setFoldState("folded"), 60);
    return () => window.clearTimeout(t1);
  }, []);

  function onFolded() {
    if (phase === "folding") setPhase("flying");
  }

  const peakY = Math.min(note.from.y, note.to.y) - 160;

  return (
    <motion.div
      initial={{
        x: note.from.x,
        y: note.from.y,
        scale: 1,
        rotate: 0,
        opacity: 1,
      }}
      animate={
        phase === "flying"
          ? {
              x: [note.from.x, (note.from.x + note.to.x) / 2, note.to.x],
              y: [note.from.y, peakY, note.to.y],
              scale: [1, 0.55, 0.22],
              rotate: [0, 8, 18],
              opacity: [1, 1, 0.9],
            }
          : { x: note.from.x, y: note.from.y, scale: 1, rotate: 0 }
      }
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={
        phase === "flying"
          ? {
              duration: 0.85,
              times: [0, 0.55, 1],
              ease: [0.22, 1, 0.36, 1],
            }
          : { duration: 0 }
      }
      onAnimationComplete={() => {
        if (phase === "flying") onComplete();
      }}
      className="fixed z-40 pointer-events-none"
      style={{
        top: 0,
        left: 0,
        width: PAPER_W,
        height: PAPER_H,
        marginLeft: -PAPER_W / 2,
        marginTop: -PAPER_H / 2,
        perspective: 1200,
        filter: "drop-shadow(0 18px 32px rgba(0,0,0,0.28))",
      }}
    >
      <FoldingPaper
        width={PAPER_W}
        height={PAPER_H}
        prompt={prompt}
        text={text}
        color={note.bg}
        state={foldState}
        onSettled={onFolded}
      />
    </motion.div>
  );
}

// =====================================================================
// SealMoment — the cinematic "seal it up" beat. The jar moves to center
// stage with NO lid, then the lid descends from above, lands with a thud,
// glass shakes, sparkles burst, "sealed with love" appears. Then we
// navigate to the share view.
// =====================================================================
function SealMoment({
  momName,
  ribbon,
  accent,
  text,
  bg,
  scentLabel,
  noteCount,
  onThud,
  onDone,
}: {
  momName: string;
  ribbon: Ribbon;
  scent: Scent;
  accent: string;
  text: string;
  bg: string;
  scentLabel: string;
  noteCount: number;
  onThud: () => void;
  onDone: () => void;
}) {
  // Descend animation duration matches Jar.tsx (1.25s, lid lands ~0.85s in).
  const [phase, setPhase] = useState<"descending" | "settled">("descending");
  const jarShake = useAnimationControls();

  useEffect(() => {
    // Lid touchdown matches keyframe time 0.7 * 1.25 = ~0.875s.
    const tImpact = window.setTimeout(() => {
      onThud();
      setPhase("settled");
      void jarShake.start({
        x: [0, -6, 5, -3, 0],
        rotate: [0, -1.2, 1, -0.4, 0],
        scale: [1, 1.03, 0.985, 1.005, 1],
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      });
    }, 870);
    const tDone = window.setTimeout(onDone, 3200);
    return () => {
      window.clearTimeout(tImpact);
      window.clearTimeout(tDone);
    };
  }, [onThud, onDone, jarShake]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5"
      style={{ background: bg }}
    >
      {/* darken everything except the jar a bit, with an accent halo */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(55% 55% at 50% 50%, ${accent}26 0%, rgba(28, 10, 24, 0.55) 80%)`,
          backdropFilter: "blur(2px)",
        }}
      />

      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 0.85, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative font-script text-3xl sm:text-4xl lg:text-5xl mb-6"
        style={{ color: accent }}
      >
        sealing the jar…
      </motion.p>

      {/* the jar with descending lid as the centerpiece */}
      <motion.div
        animate={jarShake}
        className="relative"
        style={{
          filter: `drop-shadow(0 22px 44px ${accent}66)`,
        }}
      >
        <Jar
          momName={momName}
          ribbon={ribbon}
          scentLabel={scentLabel}
          notesPreview={Array.from({ length: noteCount })}
          sealState="descending"
          className="w-56 sm:w-64 lg:w-80"
        />
      </motion.div>

      {phase === "settled" && <ImpactSparkles accent={accent} />}

      <AnimatePresence>
        {phase === "settled" && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, mass: 0.7 }}
            className="relative mt-8 font-display italic text-xl sm:text-2xl lg:text-3xl"
            style={{ color: text }}
          >
            sealed with love. for {momName}.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ImpactSparkles({ accent }: { accent: string }) {
  const items = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 24;
      // deterministic offsets
      const seed = (i * 17) % 100 / 100;
      return {
        id: i,
        angle,
        dist: 140 + seed * 120,
        size: 4 + seed * 8,
      };
    });
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative">
        {items.map((s) => (
          <motion.span
            key={s.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
              x: Math.cos(s.angle) * s.dist,
              y: Math.sin(s.angle) * s.dist - 30,
              opacity: 0,
              scale: 1.5,
            }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            className="absolute rounded-full"
            style={{
              width: s.size,
              height: s.size,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              background: accent,
              boxShadow: `0 0 14px ${accent}, 0 0 32px ${accent}cc`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Step components
// =====================================================================

function Intro({ accent, onStart }: { accent: string; onStart: () => void }) {
  return (
    <div>
      <motion.p
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.05, ...SPRING }}
        className="font-script text-4xl sm:text-5xl lg:text-6xl"
        style={{ color: accent }}
      >
        Dear Mom,
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, ...SPRING }}
        className="font-display font-semibold text-5xl sm:text-6xl lg:text-8xl mt-2 tracking-tight leading-[0.95]"
      >
        a jar of
        <br />
        memories,
        <br />
        just for her.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-5 sm:mt-6 max-w-md opacity-80 text-base sm:text-lg lg:text-xl leading-relaxed"
      >
        we&rsquo;ll prompt you with little questions. each answer folds itself
        up and drops into a jar with her name on it. send her the link —
        she opens it and reads them one by one.
      </motion.p>
      <motion.button
        type="button"
        onClick={onStart}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, ...SPRING }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        className="mt-7 sm:mt-9 rounded-full px-8 py-4 sm:px-10 sm:py-5 text-lg sm:text-xl font-semibold text-white shadow-xl"
        style={{
          background: accent,
          boxShadow: `0 12px 30px ${accent}55`,
        }}
      >
        get started →
      </motion.button>
    </div>
  );
}

function NameStep({
  value,
  onChange,
  accent,
  text,
  onBack,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
  text: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <Eyebrow accent={accent}>first,</Eyebrow>
      <BigHeading>what do you call her?</BigHeading>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        placeholder="Mom, Mama, her real name…"
        className="mt-6 sm:mt-7 w-full max-w-lg rounded-2xl bg-white/80 border border-black/5 px-5 py-4 sm:px-6 sm:py-5 text-lg sm:text-xl lg:text-2xl outline-none focus:bg-white focus:ring-4 transition placeholder:opacity-40 shadow-sm"
        style={{ color: text }}
      />
      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!value.trim()}
        accent={accent}
      />
    </div>
  );
}

function FromStep({
  value,
  onChange,
  accent,
  text,
  onBack,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
  text: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <Eyebrow accent={accent}>and you are…</Eyebrow>
      <BigHeading>sign the bottom?</BigHeading>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        placeholder="your name (optional)"
        className="mt-6 sm:mt-7 w-full max-w-lg rounded-2xl bg-white/80 border border-black/5 px-5 py-4 sm:px-6 sm:py-5 text-lg sm:text-xl lg:text-2xl outline-none focus:bg-white focus:ring-4 transition placeholder:opacity-40 shadow-sm"
        style={{ color: text }}
      />
      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={value.trim() ? "next →" : "skip →"}
        accent={accent}
      />
    </div>
  );
}

function ScentStep({
  value,
  onChange,
  onBack,
  onNext,
  accent,
}: {
  value: Scent;
  onChange: (v: Scent) => void;
  onBack: () => void;
  onNext: () => void;
  accent: string;
}) {
  return (
    <div>
      <Eyebrow accent={accent}>pick a feeling</Eyebrow>
      <BigHeading>what does she smell like?</BigHeading>
      <div className="mt-7 flex flex-wrap gap-3 max-w-lg">
        {Object.entries(SCENTS).map(([key, v]) => {
          const active = value === key;
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => onChange(key as Scent)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-full px-6 py-4 text-lg font-medium transition-all"
              style={{
                background: active ? v.accent : "rgba(255,255,255,0.65)",
                color: active ? "white" : v.text,
                boxShadow: active
                  ? `0 8px 24px ${v.accent}66`
                  : "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {v.label}
            </motion.button>
          );
        })}
      </div>
      <StepNav onBack={onBack} onNext={onNext} accent={accent} />
    </div>
  );
}

function RibbonStep({
  value,
  onChange,
  onBack,
  onNext,
  accent,
}: {
  value: Ribbon;
  onChange: (v: Ribbon) => void;
  onBack: () => void;
  onNext: () => void;
  accent: string;
}) {
  return (
    <div>
      <Eyebrow accent={accent}>tie a ribbon</Eyebrow>
      <BigHeading>her favorite color?</BigHeading>
      <div className="mt-7 flex flex-wrap gap-3 max-w-lg">
        {Object.entries(RIBBONS).map(([key, v]) => {
          const active = value === key;
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => onChange(key as Ribbon)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 rounded-full pl-3 pr-5 py-3 transition-all"
              style={{
                background: active ? "white" : "rgba(255,255,255,0.6)",
                outline: active ? `3px solid ${v.shadow}` : "none",
                boxShadow: active ? `0 8px 24px ${v.shadow}55` : "none",
              }}
            >
              <span
                className="w-7 h-7 rounded-full inline-block"
                style={{
                  background: v.color,
                  boxShadow: `inset 0 0 0 3px ${v.shadow}, 0 2px 6px ${v.shadow}55`,
                }}
              />
              <span className="text-base font-medium">{v.label}</span>
            </motion.button>
          );
        })}
      </div>
      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="start writing →"
        accent={accent}
      />
    </div>
  );
}

function MemoryStep({
  notes,
  draft,
  setDraft,
  flying,
  promptText,
  promptIndex,
  onDrop,
  onUndo,
  onSeal,
  accent,
  draftCardRef,
}: {
  notes: Memory[];
  draft: string;
  setDraft: (v: string) => void;
  flying: boolean;
  promptText: string;
  promptIndex: number;
  onDrop: () => void;
  onUndo: () => void;
  onSeal: () => void;
  accent: string;
  draftCardRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between max-w-lg">
        <Eyebrow accent={accent}>memory {notes.length + 1}</Eyebrow>
        <span className="text-sm opacity-60 font-medium">
          {notes.length} in jar
          {notes.length < 3 && ` · ${3 - notes.length} more`}
        </span>
      </div>

      {/* The prompt — the question she'll see above the answer when she opens it. */}
      <motion.div
        key={promptIndex}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="mt-2"
      >
        <h2 className="font-display italic text-2xl sm:text-3xl lg:text-5xl leading-[1.1] max-w-lg tracking-tight">
          {promptText}
        </h2>
      </motion.div>

      {/* The "paper" the user writes on — disappears when handing off to R3F. */}
      <motion.div
        ref={draftCardRef}
        layout
        className="mt-5 sm:mt-6 max-w-lg"
        animate={
          flying
            ? { opacity: 0, scale: 0.94, y: -8 }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={{ duration: 0.22 }}
      >
        <div
          className="paper rounded-lg p-4 sm:p-6"
          style={{ boxShadow: "0 14px 36px rgba(0,0,0,0.12)" }}
        >
          <p
            className="font-display italic text-xs opacity-50 mb-2"
            style={{ color: "#7a4d18" }}
          >
            {promptText}
          </p>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={220}
            rows={4}
            placeholder="write it like a little note to her…"
            className="w-full bg-transparent outline-none resize-none font-script text-xl sm:text-2xl lg:text-3xl leading-snug placeholder:opacity-40"
            style={{ color: "#5a3a14" }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs opacity-50">{draft.length}/220</span>
            <span className="text-xs opacity-50 hidden sm:block">
              ⌘ + enter to drop
            </span>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 flex flex-wrap items-center gap-3 max-w-lg">
        <motion.button
          type="button"
          onClick={onDrop}
          disabled={!draft.trim() || flying}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          className="rounded-full px-7 py-4 text-base font-semibold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: accent,
            boxShadow: `0 10px 24px ${accent}66`,
          }}
        >
          fold &amp; drop in ↓
        </motion.button>
        {notes.length >= 3 && (
          <motion.button
            type="button"
            onClick={onSeal}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-full px-6 py-4 text-base font-medium bg-white/85 hover:bg-white transition shadow"
          >
            ready to seal →
          </motion.button>
        )}
        {notes.length > 0 && (
          <button
            type="button"
            onClick={onUndo}
            className="text-sm opacity-60 hover:opacity-100 underline underline-offset-4"
          >
            undo last
          </button>
        )}
      </div>
      {notes.length >= 12 && (
        <p className="mt-3 text-sm opacity-70 max-w-md">
          that&rsquo;s the most you can fit. seal it up?
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  notes,
  momName,
  accent,
  onBack,
  onSeal,
  canSeal,
  sealing,
}: {
  notes: Memory[];
  momName: string;
  accent: string;
  onBack: () => void;
  onSeal: () => void;
  canSeal: boolean;
  sealing: boolean;
}) {
  return (
    <div>
      <Eyebrow accent={accent}>almost there</Eyebrow>
      <BigHeading>
        seal the jar
        <br />
        for {momName || "Mom"}.
      </BigHeading>
      <p className="mt-5 max-w-md opacity-80 text-lg leading-relaxed">
        {notes.length} {notes.length === 1 ? "memory" : "memories"} folded
        and inside. once you seal it, the lid goes on for real and you get a
        link to send her.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <motion.button
          type="button"
          onClick={onSeal}
          disabled={!canSeal || sealing}
          whileHover={{ scale: canSeal && !sealing ? 1.05 : 1 }}
          whileTap={{ scale: 0.96 }}
          className="rounded-full px-10 py-5 text-xl font-semibold text-white shadow-xl disabled:opacity-50"
          style={{
            background: accent,
            boxShadow: `0 14px 32px ${accent}66`,
          }}
        >
          {sealing ? "sealing…" : "seal the jar →"}
        </motion.button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-6 py-4 bg-white/80 hover:bg-white transition font-medium"
        >
          add one more
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Bits
// =====================================================================
function Eyebrow({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <p
      className="font-script text-2xl sm:text-3xl lg:text-4xl"
      style={{ color: accent }}
    >
      {children}
    </p>
  );
}

function BigHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-semibold text-4xl sm:text-5xl lg:text-7xl mt-1 tracking-tight leading-[0.98]">
      {children}
    </h2>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "next →",
  nextDisabled,
  accent,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  accent: string;
}) {
  return (
    <div className="mt-7 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full px-6 py-3 bg-white/60 hover:bg-white/90 transition text-sm font-medium"
      >
        ← back
      </button>
      <motion.button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        whileHover={{ scale: nextDisabled ? 1 : 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="rounded-full px-8 py-4 text-base font-semibold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: accent,
          boxShadow: `0 10px 24px ${accent}55`,
        }}
      >
        {nextLabel}
      </motion.button>
    </div>
  );
}
