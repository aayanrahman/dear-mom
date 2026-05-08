import type { Metadata } from "next";
import { Quicksand, Fraunces, Caveat } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Dear Mom — a memory jar made just for her",
  description:
    "Fill a little jar with your favorite memories and reasons why you love your mom. Send her the link, and she'll open a jar of love made just for her.",
  openGraph: {
    title: "Dear Mom — a memory jar made just for her",
    description:
      "Fill a jar with memories of your mom and send her the link. She'll see her name on the label and the notes will float out one by one.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${fraunces.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
