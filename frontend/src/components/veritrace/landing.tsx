"use client";

import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LABEL_TEXT, STEP_NAMES, numberClaims, percent } from "@/lib/labels";
import type { Label } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";
import { EXAMPLE } from "./example-proof";
import { Mark } from "./header";
import { STEPS } from "./how-it-works";
import { LabelTag } from "./inspector";
import { ProofMark } from "./proof-mark";
import { VerdictScale } from "./verdict-scale";

// The specimen is the worked example the app and How it works already show (example-proof.tsx),
// written against the Chandrayaan-3 sample. It is an illustration, not a recorded run, and the
// sheet says so.
const QUESTION = "What did Chandrayaan-3 do on the Moon, and how did it get there?";
const QUERIES = ["Vikram lander landing", "Pragyan rover findings", "Chandrayaan-3 launch rocket"];
const CLAIMS = EXAMPLE.map((s) => ({ ...s.claims[0], text: s.text.replace(/\s*\[S\d+\]/, "") }));
const NUMBERS = numberClaims(EXAMPLE);
// The answer's confidence as the backend rolls it up: the claim scores weighted by claim length.
const CONFIDENCE =
  CLAIMS.reduce((sum, c) => sum + c.score * c.text.length, 0) / CLAIMS.reduce((sum, c) => sum + c.text.length, 0);
const COUNTS = (["high", "inferred", "hallucinated"] as Label[]).map((label) => ({
  label,
  n: CLAIMS.filter((c) => c.label === label).length,
}));
const FLAGGED = CLAIMS.length - 1; // the PSLV claim, opened in the last step
const PASSAGE = {
  before: "Chandrayaan-3 was launched on 14 July 2023 aboard ",
  match: "an LVM3 rocket",
  after: " from the Satish Dhawan Space Centre in Sriharikota.",
};

const WALKTHROUGH: { name: string; title: string; body: React.ReactNode }[] = [
  {
    name: "Answer",
    title: "It answers from your documents alone.",
    body: (
      <>
        The agent plans its searches, finds the closest passages and writes an answer that cites them as [S1]. When
        the passages match weakly, it rewrites the queries and searches again. A question your documents cannot
        answer gets &ldquo;the documents don&apos;t contain this&rdquo;, never an invented answer.
      </>
    ),
  },
  {
    name: "Claims",
    title: "Then it treats its own answer as untrusted.",
    body: (
      <>
        The answer is split into short, self-contained claims, numbered once. The number follows each claim everywhere
        it appears: after its sentence, on the scale and in the claim check.
      </>
    ),
  },
  {
    name: "Check",
    title: "Each claim is checked and scored out of 100.",
    body: (
      <>
        An NLI model reads every claim against its passage, resampled answers show whether the claim comes back, and a
        judge settles the unclear ones. Below 45 a claim is possibly hallucinated; from 75 it is high confidence; in
        between, inferred.
      </>
    ),
  },
  {
    name: "Evidence",
    title: "Every verdict opens to its evidence.",
    body: (
      <>
        Select a sentence to see the passage it was checked against and the words the passage does not contain. The
        sample says LVM3, so the PSLV claim is flagged. Safe mode rewrites the answer without it.
      </>
    ),
  },
];

// The twelve column bars behind the page: each column is a run of bars of its own lengths, drifting
// at its own speed as the page scrolls. [bar length, gap, drift] in viewport heights.
const BARS: [number, number, number][] = [
  [38, 22, 14],
  [24, 30, 26],
  [52, 18, 8],
  [30, 26, 20],
  [20, 34, 32],
  [44, 20, 12],
  [28, 28, 24],
  [56, 16, 10],
  [22, 32, 28],
  [36, 24, 16],
  [26, 30, 30],
  [48, 20, 18],
];

/** The landing page: a checked answer pinned on screen that the visitor watches get checked, step by
 *  step, as they scroll; then the agent's steps, the evaluation and the way into the app. */
export function Landing() {
  const [step, setStep] = useState(0);
  const blocks = useRef<(HTMLElement | null)[]>([]);

  // Side by side, the pinned sheet shows the step whose text has crossed mid-screen. Stacked, nothing
  // is pinned: each step carries its own copy of the sheet, and this one stays on the finished check.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (window.matchMedia("(max-width: 63.999rem)").matches) return setStep(0);
      const line = window.innerHeight * 0.55;
      let next = 0;
      blocks.current.forEach((block, i) => {
        if (block && block.getBoundingClientRect().top < line) next = i + 1;
      });
      setStep(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div className="landing relative isolate min-h-dvh bg-canvas text-foreground">
      <ColumnBars />
      <TopNav />

      <main id="top">
        <section aria-labelledby="landing-title" className="landing-grid relative mx-auto max-w-[90rem] px-4 sm:px-8 lg:px-16">
          <div className="landing-hero pt-10 pb-8 lg:col-span-5 lg:col-start-1 lg:flex lg:min-h-[calc(100svh-3.5rem)] lg:flex-col lg:justify-center lg:py-16">
            <h1
              id="landing-title"
              className="max-w-[11ch] text-[clamp(3rem,4.6vw+1rem,5.25rem)] leading-[0.88] font-extrabold tracking-[-0.015em] [word-spacing:0.07em] font-stretch-62%"
            >
              Every claim, checked against your documents.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[18px] leading-[1.55] text-foreground/80 sm:text-[19px]">
              Ask a question of your PDFs and notes. Veritrace answers from them alone, then shows which sentences to
              trust, which to check and which to discard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="/app">Open Veritrace</PrimaryLink>
              <a
                href="#walkthrough"
                className="group inline-flex h-12 items-center gap-2 border-2 border-foreground bg-sheet px-5 text-[15px] font-semibold transition-colors duration-150 hover:bg-muted active:scale-[0.97]"
              >
                How it checks
                <ArrowDownIcon className="size-4 transition-transform duration-150 ease-(--ease-out) group-hover:translate-y-0.5" />
              </a>
            </div>
            <p className="mt-10 max-w-[34rem] border-t-2 border-foreground pt-3 text-[14px] text-muted-foreground lg:mt-14">
              <span className="font-semibold text-foreground">A checked answer.</span> Scroll to see how it was
              checked, in four steps.
              <span className="lg:hidden">
                {" "}
                It is an illustration written against the Chandrayaan-3 sample document, not a recorded run.
              </span>
            </p>
          </div>

          <div className="landing-sheet z-10 self-start lg:col-span-7 lg:col-start-6">
            <Specimen step={step} />
          </div>

          <div id="walkthrough" className="contents">
            {WALKTHROUGH.map((item, i) => (
              <article
                key={item.name}
                ref={(el) => {
                  blocks.current[i] = el;
                }}
                aria-labelledby={`step-${i + 1}`}
                className="walk-step flex flex-col justify-center lg:col-span-5 lg:col-start-1"
                data-active={step === i + 1}
                style={{ "--i": i } as React.CSSProperties}
              >
                <p aria-hidden className="figures text-[2.75rem] leading-none font-extrabold font-stretch-62%">
                  {i + 1}
                </p>
                <h2
                  id={`step-${i + 1}`}
                  className="mt-4 max-w-[18ch] text-[clamp(1.75rem,1.6vw+1.1rem,2.375rem)] leading-[1.02] font-extrabold tracking-[-0.015em] [word-spacing:0.06em] font-stretch-70%"
                >
                  {item.title}
                </h2>
                <p className="mt-4 max-w-[34rem] text-[16px] leading-[1.6] text-foreground/80 sm:text-[17px]">
                  {item.body}
                </p>
                <div className="mt-6 lg:hidden">
                  <Specimen step={i + 1} />
                </div>
              </article>
            ))}
          </div>
          {/* Room for the pinned sheet to hold the last step before the page moves on. */}
          <div aria-hidden className="landing-tail max-lg:hidden" />
        </section>

        <AgentBand />
        <Evaluation />
        <Close />
      </main>

      <Footer />
    </div>
  );
}

function ColumnBars() {
  return (
    <div aria-hidden className="landing-bars pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="mx-auto grid h-full max-w-[90rem] grid-cols-6 gap-6 px-4 sm:px-8 lg:grid-cols-12 lg:px-16">
        {BARS.map(([bar, gap, drift], i) => (
          <div
            key={i}
            className={cn("landing-bar", i >= 6 && "max-lg:hidden")}
            style={
              {
                "--bar": `${bar}vh`,
                "--gap": `${gap}vh`,
                "--drift": `-${drift}vh`,
                "--offset": `${-((i * 17) % 40)}vh`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-[90rem] items-center gap-6 px-4 sm:px-8 lg:px-16"
      >
        <Link href="/" className="mr-auto flex items-center gap-2.5" aria-label="Veritrace, home">
          <Mark className="size-[18px]" />
          <span className="text-[1.375rem] leading-none font-extrabold uppercase font-stretch-70%">Veritrace</span>
        </Link>
        <Link
          href="/how-it-works"
          className="hidden text-[14px] font-medium text-foreground/75 transition-colors duration-150 hover:text-foreground sm:inline"
        >
          How it works
        </Link>
        <a
          href="#evaluation"
          className="hidden text-[14px] font-medium text-foreground/75 transition-colors duration-150 hover:text-foreground sm:inline"
        >
          Evaluation
        </a>
        <Link
          href="/app"
          className="inline-flex h-9 items-center bg-signal px-4 text-[14px] font-semibold text-primary-foreground transition-colors duration-150 hover:bg-signal/85 active:scale-[0.97]"
        >
          Open Veritrace
        </Link>
      </nav>
    </header>
  );
}

function PrimaryLink({ href, children, large = false }: { href: string; children: React.ReactNode; large?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 bg-signal font-semibold text-primary-foreground transition-colors duration-150 hover:bg-signal/85 active:scale-[0.97]",
        large ? "h-14 px-7 text-[17px]" : "h-12 px-5 text-[15px]",
      )}
    >
      {children}
      <ArrowRightIcon className="size-4 transition-transform duration-150 ease-(--ease-out) group-hover:translate-x-0.5" />
    </Link>
  );
}

/** The worked answer on its sheet. Step 0 is the finished check; steps 1 to 4 rebuild it: the cited
 *  answer, its claims, their verdicts on the scale, and the flagged claim opened to its passage. */
function Specimen({ step }: { step: number }) {
  const verdicts = step === 0 || step >= 3;
  const numbered = step === 0 || step >= 2;
  const opened = step === 4;
  const panel = step === 1 ? "sources" : step === 2 ? "claims" : step === 4 ? "evidence" : "verdict";
  // Replay the ticks sliding onto the scale each time the check step comes into view.
  const [replays, setReplays] = useState(0);
  const [seen, setSeen] = useState(step);
  if (step !== seen) {
    setSeen(step);
    if (step === 3) setReplays(replays + 1);
  }

  return (
    <figure
      className="specimen border border-border border-t-2 border-t-foreground bg-sheet px-4 pt-3 pb-4 sm:px-8 sm:pt-5 sm:pb-6"
      data-step={step}
      aria-label="A worked example of a checked answer"
    >
      <div className="flex">
        <ol className="flex items-center gap-1" aria-label="Walkthrough progress">
          {WALKTHROUGH.map((item, i) => {
            const state = step === 0 || i + 1 < step ? "done" : i + 1 === step ? "now" : "next";
            return (
              <li key={item.name} className="flex items-center gap-1.5" data-state={state}>
                <span
                  aria-hidden
                  className={cn(
                    "h-[3px] w-5 transition-colors duration-300 sm:w-7",
                    state === "next" ? "bg-border" : "bg-foreground",
                  )}
                />
                <span
                  className={cn(
                    "caps text-[10.5px] transition-colors duration-300 max-sm:sr-only",
                    state === "now" ? "text-foreground" : "text-muted-foreground",
                    state === "next" && "text-muted-foreground/60",
                  )}
                >
                  {item.name}
                  <span className="sr-only">{state === "done" ? ", done" : state === "now" ? ", now" : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-2 max-w-[30ch] text-[clamp(1.0625rem,1.2vw+0.8rem,1.75rem)] sm:mt-3 leading-[1.08] font-bold tracking-[-0.01em] text-balance font-stretch-80%">
        {QUESTION}
      </p>

      <p className="specimen-answer mt-3 border-t border-rule pt-3 text-[14.5px] leading-[1.7] sm:mt-4 sm:pt-4 sm:leading-[1.75] text-pretty sm:text-[17px] lg:text-[1.0625rem] xl:text-[1.125rem]">
        {EXAMPLE.map((sentence, i) => (
          <span key={sentence.index}>
            <span
              className="sentence"
              data-label={verdicts ? sentence.label : "none"}
              data-dim={opened && i !== FLAGGED}
              aria-pressed={opened && i === FLAGGED ? true : undefined}
            >
              <CitedText text={sentence.text} />
            </span>
            <sup
              aria-hidden
              className={cn(
                "figures ml-px text-[11px] font-bold tracking-wide transition-[opacity,color] duration-300 font-stretch-75%",
                step === 2 ? "text-foreground" : "text-muted-foreground",
                !numbered && "opacity-0",
                opened && i !== FLAGGED && "opacity-40",
              )}
            >
              {NUMBERS.get(sentence.index)?.join(",")}
            </sup>{" "}
          </span>
        ))}
      </p>

      <div className="specimen-panels mt-4 grid sm:mt-5">
        <Panel show={panel === "sources"}>
          <p className="caps border-t-2 border-foreground pt-2 text-muted-foreground">Searched for</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {QUERIES.map((q) => (
              <li key={q} className="bg-muted px-2 py-0.5 text-[13px]">
                {q}
              </li>
            ))}
          </ul>
          <p className="caps mt-4 border-t border-rule pt-2 text-muted-foreground">Source</p>
          <p className="mt-2 flex items-baseline gap-2 text-[13px]">
            <span className="figures bg-signal-soft px-1 text-[11px] leading-4 font-bold text-signal">S1</span>
            <span>
              <span className="font-semibold">chandrayaan-3.md</span>
              <span className="text-muted-foreground"> · Launch and journey, Landing, Rover and science results</span>
            </span>
          </p>
        </Panel>

        <Panel show={panel === "claims"}>
          <div className="flex items-baseline justify-between border-t-2 border-foreground pt-2">
            <p className="caps text-muted-foreground">Claims</p>
            <p className="figures text-[13px] text-muted-foreground">{CLAIMS.length}</p>
          </div>
          <ol className="divide-y divide-rule">
            {CLAIMS.map((claim, i) => (
              <li key={claim.text} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 py-1.5 text-[13.5px] leading-snug">
                <span className="figures font-bold font-stretch-75%">{i + 1}</span>
                <span>{claim.text}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel show={panel === "verdict"}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-5 gap-y-3 border-t-2 border-foreground pt-3">
            <p className="flex items-baseline gap-2">
              <span className="figures text-[clamp(3.5rem,4vw+1rem,5rem)] leading-[0.8] font-extrabold tracking-[-0.03em] font-stretch-62%">
                {percent(CONFIDENCE)}
              </span>
              <span className="text-[13px] leading-tight text-muted-foreground">
                / 100
                <br />
                confidence
              </span>
            </p>
            <ul className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[13px]">
              {COUNTS.map(({ label, n }) => (
                <li key={label} className="flex items-center gap-1.5">
                  <ProofMark label={label} className="size-3.5" />
                  <span className="figures font-semibold">{n}</span>
                  <span className="text-muted-foreground">{LABEL_TEXT[label]}</span>
                </li>
              ))}
            </ul>
          </div>
          <VerdictScale
            key={replays}
            className="mt-4"
            claims={CLAIMS.map((c, i) => ({ n: i + 1, sentence: i, label: c.label, score: c.score }))}
            confidence={CONFIDENCE}
            animate={verdicts}
          />
        </Panel>

        <Panel show={panel === "evidence"}>
          <div className="flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-2">
            <p className="flex items-baseline gap-3">
              <span className="caps text-muted-foreground">Claim {FLAGGED + 1}</span>
              <LabelTag label={CLAIMS[FLAGGED].label} />
            </p>
            <p className="figures text-[2rem] leading-none font-extrabold text-halluc font-stretch-62%">
              {percent(CLAIMS[FLAGGED].score)}
            </p>
          </div>
          <p className="mt-2 text-[13.5px] leading-snug text-foreground/85">
            The passage it cites names a different rocket, and the judge reads the claim as contradicted.
          </p>
          <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            Not in the passage:
            <span className="bg-muted px-2 py-0.5 text-foreground">PSLV</span>
          </p>
          <blockquote className="mt-3 border-2 border-foreground px-3 py-2.5 text-[13.5px] leading-[1.55]">
            <p className="mb-1 flex items-baseline gap-2 text-[12px] text-muted-foreground">
              <span className="figures bg-signal-soft px-1 text-[11px] leading-4 font-bold text-signal">S1</span>
              chandrayaan-3.md · Launch and journey
            </p>
            {PASSAGE.before}
            <mark className={cn("bg-signal-soft text-foreground", opened && "evidence-flash")}>{PASSAGE.match}</mark>
            {PASSAGE.after}
          </blockquote>
        </Panel>
      </div>

      <figcaption className="mt-4 text-[12px] leading-relaxed text-muted-foreground max-lg:hidden">
        An illustration written against the Chandrayaan-3 sample document, not a recorded run.
      </figcaption>
    </figure>
  );
}

/** One of the sheet's lower panels. They share one grid cell, so the sheet keeps its height while
 *  they change over. */
function Panel({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div className="specimen-panel [grid-area:1/1]" data-show={show} aria-hidden={!show} inert={!show}>
      {children}
    </div>
  );
}

/** The agent's steps, on the rail's black: the wait is the work, so every step is listed. */
function AgentBand() {
  return (
    <section id="agent" aria-labelledby="agent-title" className="dark rail-scope relative scroll-mt-14 mt-24 bg-rail text-foreground lg:mt-32">
      <div className="mx-auto grid max-w-[90rem] gap-x-6 gap-y-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:px-16 lg:py-28">
        <div className="lg:col-span-4">
          <h2
            id="agent-title"
            className="max-w-[12ch] text-[clamp(2.25rem,2.6vw+1.25rem,3.75rem)] leading-[0.92] font-extrabold tracking-[-0.015em] [word-spacing:0.07em] font-stretch-62%"
          >
            The agent works where you can see it.
          </h2>
          <p className="mt-6 max-w-[30rem] text-[16px] leading-[1.6] text-foreground/75">
            A question takes from a few seconds to about a minute. Each step streams in live as it runs, retries
            included, with its time beside it, so the wait shows its work.
          </p>
        </div>
        <ol className="grid gap-x-10 border-t-2 border-foreground sm:grid-cols-2 lg:col-span-8">
          {STEPS.map((s, i) => (
            <li
              key={s.node}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-b border-border py-4 text-[15px]"
            >
              <span className="figures text-[1.75rem] leading-none font-extrabold font-stretch-62%">{i + 1}</span>
              <span>
                <span className="font-semibold">
                  {STEP_NAMES[s.node]}
                  {s.node === "revise" && <span className="font-normal text-muted-foreground"> (safe mode)</span>}
                </span>
                <span className="mt-1 block leading-snug text-muted-foreground">{s.what}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// From docs/evaluation.md: the fresh held-out set (claims written before the 0.9.0 changes and never
// tuned on) and the synthetic planted errors, both run with qwen3:4b-instruct.
const FRESH: { figure: string; of?: string; what: string }[] = [
  { figure: "12", of: "of 12", what: "hallucinated claims caught" },
  { figure: "0", of: "of 15", what: "stated claims wrongly called hallucinated" },
  { figure: "81%", what: "of claims given the right label of the three" },
];
const PLANTED: { figure: string; of?: string; what: string }[] = [
  { figure: "80", of: "of 86", what: "claims with one fact changed were caught" },
  { figure: "0", of: "of 85", what: "unchanged claims were flagged" },
];
const LIMITS = [
  "Correct paraphrases are often labelled Inferred: 15 of 39 supported claims on the test set. A claim with a fifth or more of its words missing from its passage counts as a deduction. That is the safe direction to be wrong in.",
  "3 of the 10 inferred claims on the fresh set were called hallucinated: the small judge sometimes reads approximate arithmetic as a contradiction.",
  "6 of the 86 planted errors got through, all of them a name swapped for another from the same document.",
];

function Evaluation() {
  return (
    <section
      id="evaluation"
      aria-labelledby="evaluation-title"
      className="mx-auto grid max-w-[90rem] scroll-mt-14 gap-x-6 gap-y-12 px-4 py-24 sm:px-8 lg:grid-cols-12 lg:px-16 lg:py-32"
    >
      <div className="lg:col-span-4">
        <h2
          id="evaluation-title"
          className="max-w-[12ch] text-[clamp(2.25rem,2.6vw+1.25rem,3.75rem)] leading-[0.92] font-extrabold tracking-[-0.015em] [word-spacing:0.07em] font-stretch-62%"
        >
          Measured on claims labelled by hand.
        </h2>
        <p className="mt-6 max-w-[30rem] text-[16px] leading-[1.6] text-foreground/80">
          The rules and settings were tuned on one set of claims and scored on others they never saw. The writer and
          judge in these runs was <span className="whitespace-nowrap">qwen3:4b-instruct</span>, a small local model. The live
          app runs on Groq&apos;s <span className="whitespace-nowrap">gpt-oss-120b</span>, which was not evaluated here.
        </p>
        <Link
          href="/how-it-works"
          className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-signal underline-offset-4 hover:underline"
        >
          Full results and the scoring rules
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>

      <div className="grid gap-x-6 gap-y-12 md:grid-cols-2 lg:col-span-8">
        <FigureTable caption="Fresh held-out set · 37 claims" rows={FRESH} />
        <FigureTable caption="Planted errors · 171 claims" rows={PLANTED} />
        <div className="md:col-span-2">
          <h3 className="border-t-2 border-foreground pt-3 text-[1.5rem] leading-none font-extrabold tracking-[-0.01em] [word-spacing:0.06em] font-stretch-70%">
            Where it falls short
          </h3>
          <ul className="mt-2 divide-y divide-rule">
            {LIMITS.map((limit) => (
              <li key={limit} className="max-w-[72ch] py-3 text-[15px] leading-[1.6] text-foreground/85">
                {limit}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FigureTable({ caption, rows }: { caption: string; rows: { figure: string; of?: string; what: string }[] }) {
  return (
    <figure>
      <figcaption className="caps border-t-2 border-foreground pt-2 text-muted-foreground">
        {caption}
      </figcaption>
      <dl className="divide-y divide-rule">
        {rows.map((row) => (
          <div key={row.what} className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] items-baseline gap-x-4 py-4">
            <dt className="figures flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-[clamp(2.5rem,2vw+1.5rem,3.5rem)] leading-[0.85] font-extrabold tracking-[-0.02em] font-stretch-62%">
                {row.figure}
              </span>
              {row.of && <span className="text-[15px] font-semibold text-muted-foreground">{row.of}</span>}
            </dt>
            <dd className="text-[15px] leading-snug text-foreground/85">{row.what}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

function Close() {
  return (
    <section aria-labelledby="close-title" className="mx-auto max-w-[90rem] px-4 pb-24 sm:px-8 lg:px-16 lg:pb-32">
      <div className="grid gap-x-6 gap-y-8 border-t-2 border-foreground pt-8 lg:grid-cols-12 lg:pt-10">
        <h2
          id="close-title"
          className="max-w-[14ch] text-[clamp(2.75rem,4vw+1rem,5.25rem)] leading-[0.88] font-extrabold tracking-[-0.015em] [word-spacing:0.07em] font-stretch-62% lg:col-span-7"
        >
          See which sentences to trust.
        </h2>
        <div className="lg:col-span-5 lg:self-end">
          <p className="max-w-[30rem] text-[17px] leading-[1.6] text-foreground/80">
            Add the two sample documents, Chandrayaan-3 and the James Webb Space Telescope, and ask a question. Or upload
            your own PDF, .txt or .md files.
          </p>
          <div className="mt-6">
            <PrimaryLink href="/app" large>
              Open Veritrace
            </PrimaryLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-6 text-[13px] text-muted-foreground sm:px-8 lg:px-16">
        <span className="mr-auto flex items-center gap-2 text-foreground">
          <Mark className="size-4" />
          <span className="text-[1rem] leading-none font-extrabold uppercase font-stretch-70%">Veritrace</span>
          <span className="text-muted-foreground">Hallucination-aware information assistant</span>
        </span>
        <Link href="/how-it-works" className="transition-colors duration-150 hover:text-foreground">
          How it works
        </Link>
        <Link href="/app" className="transition-colors duration-150 hover:text-foreground">
          Open Veritrace
        </Link>
      </div>
    </footer>
  );
}
