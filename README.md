# Dear Mom 💌

A tiny website that lets you fill a memory jar for your mom.

You enter her name, pick a ribbon color and a scent, and add a few memories
or reasons why you love her. The site generates a unique link — you text it
to her and she opens her own little jar, with her name on the label, and the
notes float out one by one.

No accounts, no database. The jar lives in the URL itself.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind v4
- Motion (Framer Motion)
- URL-encoded data (base64url JSON) — no backend required
