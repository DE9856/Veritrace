import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// One grotesk for everything, as Swiss information design sets it: Archivo's width axis gives the
// condensed cut for numerals and headings and the regular cut for reading. Geist Mono is for code only.
const ui = Archivo({ variable: "--font-ui", subsets: ["latin"], axes: ["wdth"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Veritrace",
  description:
    "Answers from your documents, with every claim labelled as stated, inferred or possibly hallucinated.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${ui.variable} ${code.variable} h-full antialiased`}>
      <body className="h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300} skipDelayDuration={400}>
            {children}
          </TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
