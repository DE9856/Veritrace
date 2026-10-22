import type { Metadata } from "next";

import { Landing } from "@/components/veritrace/landing";

export const metadata: Metadata = {
  title: "Veritrace · Every claim, checked against your documents",
};

export default function Home() {
  return <Landing />;
}
