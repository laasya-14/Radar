import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Newsreader, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import KeyboardNav from "@/components/KeyboardNav";

// Type: DM Sans for UI, Newsreader for display, Source Serif 4 for reading.
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap", weight: ["400", "500", "600"] });
const display = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap", style: ["normal", "italic"], axes: ["opsz"] });
const reading = Source_Serif_4({ subsets: ["latin"], variable: "--font-reading", display: "swap", style: ["normal", "italic"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Radar",
  description: "Your personal feed of things worth exploring.",
};

// Runs before first paint so the page never flashes the wrong theme.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark'}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${reading.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Nav />
        <main className="main">{children}</main>
        <KeyboardNav />
      </body>
    </html>
  );
}
