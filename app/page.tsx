"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Jar from "@/components/Jar";
import {
  encodeJar,
  RIBBONS,
  SCENTS,
  type JarData,
  type Ribbon,
  type Scent,
} from "@/lib/jar";

const STARTER_NOTES = [
  "The way you laugh at your own jokes",
  "How you always remember how I take my coffee",
  "Your hugs after a long day",
];

export default function CreatePage() {
  const router = useRouter();
  const [momName, setMomName] = useState("");
  const [fromName, setFromName] = useState("");
  const [ribbon, setRibbon] = useState<Ribbon>("blush");
  const [scent, setScent] = useState<Scent>("rose");
  const [notes, setNotes] = useState<string[]>(["", "", ""]);
  const [sealing, setSealing] = useState(false);

  const filledNotes = notes.filter((n) => n.trim().length > 0);
  const canSeal = momName.trim().length > 0 && filledNotes.length >= 3;

  const scentTheme = SCENTS[scent];

  const previewData: JarData = useMemo(
    () => ({ m: momName || "Mom", f: fromName, r: ribbon, s: scent, n: filledNotes }),
    [momName, fromName, ribbon, scent, filledNotes],
  );

  function updateNote(i: number, v: string) {
    setNotes((prev) => prev.map((n, idx) => (idx === i ? v : n)));
  }

  function addNote() {
    if (notes.length >= 12) return;
    setNotes((prev) => [...prev, ""]);
  }

  function removeNote(i: number) {
    setNotes((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSeal() {
    if (!canSeal) return;
    setSealing(true);
    const slug = encodeJar(previewData);
    setTimeout(() => router.push(`/jar/${slug}`), 700);
  }

  return (
    <main
      className="flex-1 w-full"
      style={{ background: scentTheme.bg, color: scentTheme.text }}
    >
      <div className="mx-auto max-w-6xl px-5 py-10 lg:py-16">
        <header className="text-center mb-10 lg:mb-14 fade-in">
          <p className="font-script text-3xl lg:text-4xl" style={{ color: scentTheme.accent }}>
            Dear Mom,
          </p>
          <h1 className="font-display text-4xl lg:text-6xl mt-1 tracking-tight">
            Fill her a memory jar
          </h1>
          <p className="mt-4 max-w-xl mx-auto opacity-80 text-base lg:text-lg">
            Add a few of your favorite memories of her. We&rsquo;ll seal them in
            a little jar with her name on the label. Send her the link &mdash;
            she&rsquo;ll open it and they&rsquo;ll float out one by one.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1fr_minmax(280px,360px)] gap-10 items-start">
          <section className="space-y-7">
            <div>
              <label className="block font-display italic text-sm tracking-wide mb-2 opacity-80">
                Her name
              </label>
              <input
                value={momName}
                onChange={(e) => setMomName(e.target.value)}
                maxLength={60}
                placeholder="Mom, Mama, her real name…"
                className="w-full rounded-xl bg-white/70 border border-black/10 px-4 py-3 text-lg outline-none focus:bg-white focus:ring-2 transition placeholder:opacity-40"
                style={{ color: scentTheme.text }}
              />
            </div>

            <div>
              <label className="block font-display italic text-sm tracking-wide mb-2 opacity-80">
                Your name (signed at the bottom)
              </label>
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                maxLength={60}
                placeholder="Your name"
                className="w-full rounded-xl bg-white/70 border border-black/10 px-4 py-3 text-lg outline-none focus:bg-white focus:ring-2 transition placeholder:opacity-40"
                style={{ color: scentTheme.text }}
              />
            </div>

            <div>
              <span className="block font-display italic text-sm tracking-wide mb-2 opacity-80">
                Ribbon color
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(RIBBONS).map(([key, v]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRibbon(key as Ribbon)}
                    className={`flex items-center gap-2 rounded-full px-3 py-2 border transition text-sm ${
                      ribbon === key
                        ? "bg-white shadow-sm"
                        : "bg-white/40 hover:bg-white/70"
                    }`}
                    style={{ borderColor: ribbon === key ? v.shadow : "transparent" }}
                  >
                    <span
                      className="w-4 h-4 rounded-full inline-block"
                      style={{ background: v.color, boxShadow: `inset 0 0 0 2px ${v.shadow}` }}
                    />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block font-display italic text-sm tracking-wide mb-2 opacity-80">
                Scent
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SCENTS).map(([key, v]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setScent(key as Scent)}
                    className={`rounded-full px-3 py-2 border transition text-sm ${
                      scent === key
                        ? "bg-white shadow-sm"
                        : "bg-white/40 hover:bg-white/70"
                    }`}
                    style={{ borderColor: scent === key ? v.accent : "transparent" }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-display italic text-sm tracking-wide opacity-80">
                  Memories &amp; reasons you love her
                </span>
                <span className="text-xs opacity-60">
                  {filledNotes.length} / 12 &middot; minimum 3
                </span>
              </div>
              <ul className="space-y-2">
                {notes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <textarea
                      value={note}
                      onChange={(e) => updateNote(i, e.target.value)}
                      maxLength={220}
                      rows={2}
                      placeholder={STARTER_NOTES[i] ?? "Another memory…"}
                      className="flex-1 rounded-xl bg-white/70 border border-black/10 px-4 py-3 outline-none focus:bg-white focus:ring-2 transition placeholder:opacity-40 resize-none"
                      style={{ color: scentTheme.text }}
                    />
                    {notes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeNote(i)}
                        aria-label="remove memory"
                        className="self-stretch px-3 rounded-xl bg-white/40 hover:bg-white/70 transition text-lg"
                      >
                        &times;
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {notes.length < 12 && (
                <button
                  type="button"
                  onClick={addNote}
                  className="mt-3 text-sm underline underline-offset-4 opacity-70 hover:opacity-100"
                >
                  + add another memory
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSeal}
                disabled={!canSeal || sealing}
                className="w-full lg:w-auto rounded-full px-8 py-4 text-lg font-medium text-white shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-100"
                style={{ background: scentTheme.accent }}
              >
                {sealing ? "Sealing the jar…" : "Seal the jar →"}
              </button>
              {!canSeal && (
                <p className="mt-2 text-xs opacity-60">
                  Add her name and at least 3 memories to seal the jar.
                </p>
              )}
            </div>
          </section>

          <aside className="lg:sticky lg:top-10">
            <div
              className="rounded-3xl p-6 backdrop-blur-sm"
              style={{ background: "rgba(255,255,255,0.35)" }}
            >
              <p className="text-xs uppercase tracking-[0.2em] opacity-60 text-center mb-2">
                Live preview
              </p>
              <div className="flex justify-center">
                <Jar
                  momName={previewData.m}
                  ribbon={previewData.r}
                  scentLabel={SCENTS[previewData.s].label}
                  notesPreview={previewData.n}
                  className="w-56 lg:w-64"
                />
              </div>
              <p className="text-center text-sm opacity-70 mt-3 italic font-display">
                {filledNotes.length === 0
                  ? "An empty jar… for now."
                  : `${filledNotes.length} ${filledNotes.length === 1 ? "memory" : "memories"} ready to seal`}
              </p>
            </div>
          </aside>
        </div>

        <footer className="text-center mt-16 opacity-60 text-sm">
          Made with love for Mother&rsquo;s Day. No accounts, no tracking — your
          memories live in the link itself.
        </footer>
      </div>
    </main>
  );
}
