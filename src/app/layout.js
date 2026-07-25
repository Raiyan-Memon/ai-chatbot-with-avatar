import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AI Avatar — Raiyan Memon",
  description:
    "A talking 3D avatar with lip sync and Google text-to-speech, built by Raiyan Memon.",
  authors: [{ name: "Raiyan Memon" }],
  creator: "Raiyan Memon",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Starts the model download alongside the HTML instead of waiting for
          React to hydrate and run the fetch. */}
      <link rel="preload" href="/avatar-optimized.glb" as="fetch" />

      <body className="h-full overflow-hidden flex flex-col">{children}</body>
    </html>
  );
}
