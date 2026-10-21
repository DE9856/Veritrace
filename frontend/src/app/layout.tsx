import type { Metadata } from "next";
import { Geist_Mono, Schibsted_Grotesk, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Schibsted Grotesk, a newsroom grotesk, sets the checking apparatus (labels, scores, controls).
// Source Serif 4 sets the copy under check (answers, passages) and the page's own voice (headings,
// the wordmark, the confidence figure); its optical-size axis gives large sizes the display cut.
// Geist Mono is for code only.
const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const copy = Source_Serif_4({ variable: "--font-copy", subsets: ["latin"], axes: ["opsz"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Veritrace",
  description:
    "Answers from your documents, with every claim labelled as stated, inferred or possibly hallucinated.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ui.variable} ${copy.variable} ${code.variable} h-full antialiased`}
    >
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
