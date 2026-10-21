"use client";

import { BookOpenIcon, MenuIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Health } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Veritrace's mark: the V drawn as a checker's tick. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={cn("size-5 shrink-0 text-pencil", className)}>
      <path
        d="M3.5 9.8 8 14.6 16.5 3.8"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The product's name and line, at the top of the sidebar. The page's h1 lives here on wide
 *  screens and in the phone bar otherwise, so there is always exactly one. */
export function Brand({ heading }: { heading: boolean }) {
  const Name = heading ? "h1" : "p";
  return (
    <div className="flex items-start gap-2.5 px-2">
      <Mark className="mt-px" />
      <div className="min-w-0">
        <Name className="font-serif text-[1.3125rem] leading-6 font-semibold tracking-[-0.015em]">Veritrace</Name>
        <p className="text-xs leading-4 text-muted-foreground">Hallucination-Aware Information Assistant</p>
      </div>
    </div>
  );
}

/** Model status, the explainer and the theme, pinned to the foot of the sidebar. */
export function SidebarFooter({ health, healthError }: { health: Health | null; healthError: string | null }) {
  return (
    <div className="mt-auto space-y-1 border-t border-rule pt-3">
      <HealthStatus health={health} error={healthError} />
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
          <Link href="/how-it-works">
            <BookOpenIcon /> How it works
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}

/** The phone's top bar: menu, name, model status. The sidebar opens as a sheet from the menu. */
export function MobileBar({
  health,
  healthError,
  onOpenMenu,
}: {
  health: Health | null;
  healthError: string | null;
  onOpenMenu: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-rule bg-background px-2">
      <Button variant="ghost" size="icon" onClick={onOpenMenu} aria-label="Show documents and settings">
        <MenuIcon />
      </Button>
      <Mark className="size-[18px]" />
      <h1 className="font-serif text-lg font-semibold tracking-[-0.015em]">Veritrace</h1>
      <div className="ml-auto">
        <StatusDot health={health} error={healthError} />
      </div>
    </header>
  );
}

function statusOf(health: Health | null, error: string | null) {
  const ok = health?.status === "ok";
  return {
    // The pencil, not a verdict colour: filled when a model is serving, a hollow ring when it is not.
    tone: ok ? "bg-pencil" : health || error ? "border-[1.5px] border-foreground" : "bg-muted-foreground",
    ok,
    label: health ? health.llm.model : error ? "Backend offline" : "Connecting…",
    detail: health
      ? ok
        ? `${health.llm.provider} · ${health.llm.model}. Verifier: ${health.nli_model.split("/").pop()}.`
        : (health.llm.detail ?? "The language model is not available.")
      : (error ?? "Checking the backend."),
    sub: health ? (ok ? health.llm.provider : "Model unavailable") : error ? "Start it, then reload" : null,
  };
}

function StatusDot({ health, error }: { health: Health | null; error: string | null }) {
  const status = statusOf(health, error);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex max-w-44 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground"
        >
          <span className={cn("size-2 shrink-0 rounded-full", status.tone, !health && !error && "animate-pulse")} />
          <span className="truncate">{status.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{status.detail}</TooltipContent>
    </Tooltip>
  );
}

function HealthStatus({ health, error }: { health: Health | null; error: string | null }) {
  const status = statusOf(health, error);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="flex cursor-default items-start gap-2.5 rounded-md px-2 py-1.5">
          <span
            className={cn(
              "mt-1.5 size-2 shrink-0 rounded-full",
              status.tone,
              !health && !error && "animate-pulse",
            )}
          />
          <div className="min-w-0 text-[13px] leading-5">
            <p className="truncate font-medium">{status.label}</p>
            {status.sub && <p className="truncate text-xs text-muted-foreground">{status.sub}</p>}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        {status.detail}
      </TooltipContent>
    </Tooltip>
  );
}

const THEMES = [
  { value: "system", icon: MonitorIcon, label: "System theme" },
  { value: "light", icon: SunIcon, label: "Light theme" },
  { value: "dark", icon: MoonIcon, label: "Dark theme" },
] as const;

/** Three explicit choices rather than a button that cycles through them unseen. */
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The theme is only known in the browser; render no choice as pressed on the server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-px rounded-md bg-muted p-0.5">
      {THEMES.map(({ value, icon: Icon, label }) => {
        const active = mounted && theme === value;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setTheme(value)}
                aria-label={label}
                aria-pressed={active}
                className={cn(
                  "flex size-6 items-center justify-center rounded-[4px] text-muted-foreground transition-[background-color,color,transform] duration-150 hover:text-foreground active:scale-[0.94]",
                  active && "bg-sheet text-foreground ring-1 ring-border",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
