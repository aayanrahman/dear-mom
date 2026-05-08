import { headers } from "next/headers";
import Link from "next/link";
import JarViewer from "@/components/JarViewer";
import { decodeJar } from "@/lib/jar";
import type { Metadata } from "next";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = decodeJar(id);
  const title = data
    ? `A memory jar for ${data.m}`
    : "Dear Mom — a memory jar";
  const description = data
    ? `Someone made a little jar of memories just for ${data.m}. Tap to open it.`
    : "A memory jar made just for her.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function JarPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = decodeJar(id);

  if (!data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="font-script text-4xl mb-2" style={{ color: "#c46079" }}>
          oh no…
        </p>
        <h1 className="font-display text-3xl mb-3">This jar can&rsquo;t be opened</h1>
        <p className="opacity-70 max-w-md">
          The link looks broken. Make sure you copied the whole link, or ask
          whoever sent it to send it again.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-full px-6 py-3 bg-rose-300 hover:bg-rose-400 text-white transition"
        >
          Make a jar of your own
        </Link>
      </main>
    );
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const shareUrl = host ? `${proto}://${host}/jar/${id}` : `/jar/${id}`;

  return <JarViewer data={data} shareUrl={shareUrl} />;
}
