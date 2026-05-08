"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Jar from "./Jar";
import { SCENTS, type JarData } from "@/lib/jar";

const NOTE_COLORS = [
  { bg: "#fff3d6", ink: "#7a4d18" },
  { bg: "#ffe0e6", ink: "#8b2a4a" },
  { bg: "#e3f0d7", ink: "#3e5d2a" },
  { bg: "#e0e9f6", ink: "#2c4773" },
  { bg: "#f3e3f6", ink: "#5d2a73" },
  { bg: "#fdebd0", ink: "#7d4a14" },
];

export default function JarViewer({ data, shareUrl }: { data: JarData; shareUrl: string }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [showFinal, setShowFinal] = useState(false);
  const [copied, setCopied] = useState(false);

  const scent = SCENTS[data.s];
  const allRevealed = revealed.length === data.n.length;

  const noteRotations = useMemo(
    () => data.n.map(() => (Math.random() - 0.5) * 14),
    [data.n],
  );

  useEffect(() => {
    if (allRevealed && !showFinal && open) {
      const t = setTimeout(() => setShowFinal(true), 800);
      return () => clearTimeout(t);
    }
  }, [allRevealed, showFinal, open]);

  function openJar() {
    if (open) return;
    setOpen(true);
  }

  function pickNote(i: number) {
    if (revealed.includes(i)) return;
    setActiveNote(i);
  }

  function closeNote() {
    if (activeNote !== null && !revealed.includes(activeNote)) {
      setRevealed((prev) => [...prev, activeNote]);
    }
    setActiveNote(null);
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
      className="flex-1 w-full relative overflow-hidden"
      style={{ background: scent.bg, color: scent.text }}
    >
      <div className="mx-auto max-w-3xl px-5 py-10 lg:py-16 min-h-screen flex flex-col">
        <header className="text-center mb-6 fade-in">
          <p className="font-script text-3xl lg:text-4xl" style={{ color: scent.accent }}>
            For {data.m}
          </p>
          {!open && (
            <p className="font-display italic mt-2 opacity-80">
              someone made this jar just for you
            </p>
          )}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.div
            animate={
              open
                ? { scale: 0.78, y: 20 }
                : { scale: 1, y: 0 }
            }
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <Jar
              momName={data.m}
              ribbon={data.r}
              scentLabel={scent.label}
              notesPreview={data.n}
              open={open}
              className="w-72 lg:w-80"
            />
          </motion.div>

          {!open && (
            <motion.button
              type="button"
              onClick={openJar}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="mt-6 rounded-full px-8 py-4 text-lg font-medium text-white shadow-md"
              style={{ background: scent.accent }}
            >
              Untie the ribbon →
            </motion.button>
          )}

          {open && !showFinal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="mt-6 text-center max-w-md"
            >
              <p className="font-display italic text-lg">
                {revealed.length === 0
                  ? "tap a note to read it"
                  : allRevealed
                    ? "you found them all…"
                    : `${revealed.length} of ${data.n.length} read`}
              </p>
            </motion.div>
          )}
        </div>

        {/* Floating notes */}
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 pointer-events-none">
              {data.n.map((_, i) => {
                if (revealed.includes(i) || activeNote === i) return null;
                const col = NOTE_COLORS[i % NOTE_COLORS.length];
                const angleOffset = (i / data.n.length) * Math.PI * 2;
                const radius = 180 + (i % 3) * 30;
                const left = 50 + Math.cos(angleOffset) * 22;
                const top = 50 + Math.sin(angleOffset) * 18;
                return (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => pickNote(i)}
                    initial={{
                      x: 0,
                      y: 60,
                      opacity: 0,
                      scale: 0.5,
                      rotate: 0,
                    }}
                    animate={{
                      x: 0,
                      y: [60, -10, 0],
                      opacity: 1,
                      scale: 1,
                      rotate: noteRotations[i],
                    }}
                    transition={{
                      duration: 1.4,
                      delay: 0.6 + i * 0.18,
                      ease: "easeOut",
                    }}
                    whileHover={{ scale: 1.08, rotate: 0 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute pointer-events-auto rounded-sm shadow-lg cursor-pointer"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      background: col.bg,
                      color: col.ink,
                      width: "min(64px, 14vw)",
                      height: "min(64px, 14vw)",
                      padding: "8px",
                      fontFamily: "var(--font-caveat), cursive",
                      fontSize: "13px",
                      lineHeight: 1.1,
                      animation: `gentle-bob ${3 + (i % 3) * 0.6}s ease-in-out ${i * 0.3}s infinite`,
                      boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
                    }}
                    aria-label={`Open note ${i + 1}`}
                  >
                    <span className="block">tap</span>
                    <span className="block">to</span>
                    <span className="block">open</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* Active note modal */}
        <AnimatePresence>
          {activeNote !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
              onClick={closeNote}
            >
              <motion.div
                initial={{ scale: 0.4, rotateY: -90, opacity: 0 }}
                animate={{ scale: 1, rotateY: 0, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="paper rounded-md max-w-lg w-full p-8 lg:p-10 shadow-2xl relative"
                style={{
                  color: NOTE_COLORS[activeNote % NOTE_COLORS.length].ink,
                  transform: `rotate(${noteRotations[activeNote]}deg)`,
                }}
              >
                <p
                  className="font-script text-2xl lg:text-3xl leading-snug whitespace-pre-wrap"
                  style={{ minHeight: "120px" }}
                >
                  {data.n[activeNote]}
                </p>
                <button
                  type="button"
                  onClick={closeNote}
                  className="mt-6 text-sm opacity-60 hover:opacity-100 underline underline-offset-4"
                >
                  close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final message */}
        <AnimatePresence>
          {showFinal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center p-6"
              style={{ background: scent.bg }}
            >
              <motion.div
                initial={{ scale: 0.8, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="text-center max-w-xl"
              >
                <p
                  className="font-script text-5xl lg:text-7xl leading-tight"
                  style={{ color: scent.accent }}
                >
                  I love you,
                </p>
                <p className="font-script text-5xl lg:text-7xl mt-2" style={{ color: scent.accent }}>
                  {data.m}
                </p>
                {data.f && (
                  <p
                    className="font-display italic text-xl lg:text-2xl mt-8 opacity-80"
                    style={{ color: scent.text }}
                  >
                    — {data.f}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowFinal(false);
                    setRevealed([]);
                    setOpen(false);
                  }}
                  className="mt-12 text-sm opacity-60 hover:opacity-100 underline underline-offset-4"
                >
                  read them again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center text-sm">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full px-5 py-2 bg-white/60 hover:bg-white transition"
          >
            {copied ? "link copied ✓" : "copy this jar's link"}
          </button>
          <a
            href="/"
            className="rounded-full px-5 py-2 bg-white/40 hover:bg-white/70 transition text-center"
          >
            make one for your mom
          </a>
        </div>
      </div>
    </main>
  );
}
