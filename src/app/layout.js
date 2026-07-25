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
  title: "Ask Raiyan Memon — AI Assistant",
  description:
    "An AI assistant that answers questions about Raiyan Memon's experience, projects and skills, spoken by a 3D avatar.",
  authors: [{ name: "Raiyan Memon" }],
  creator: "Raiyan Memon",
  openGraph: {
    title: "Ask Raiyan Memon — AI Assistant",
    description:
      "Ask about my experience, projects and skills. My AI assistant answers out loud.",
    type: "website",
  },
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
