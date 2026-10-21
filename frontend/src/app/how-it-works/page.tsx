import type { Metadata } from "next";

import { HowItWorks } from "@/components/veritrace/how-it-works";

export const metadata: Metadata = { title: "How it works · Veritrace" };

export default function Page() {
  return <HowItWorks />;
}
