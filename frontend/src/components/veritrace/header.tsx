"use client";

import { BookOpenIcon, MenuIcon, MonitorIcon, MoonIcon, PanelRightIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Health } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PANEL_ID } from "./inspector";

/** Veritrace's mark: a tick in a square, the one verdict the product hopes to give. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={cn("size-5 shrink-0", className)}>
      <rect x="0.75" y="0.75" width="18.5" height="18.5" stroke="currentColor" strokeWidth={1.5} />
      <path d="M5 10.2 8.4 13.6 15 6.4" stroke="currentColor" strokeWidth={2.2} strokeLinecap="square" />
    </svg>
  );
}

/** The product's name and line, at the top of the rail. The page's h1 lives here on wide screens
 *  and in the phone bar otherwise, so there is always exactly one. */
export function Brand({ heading }: { heading: boolean }) {
  const Name = heading ? "h1" : "p";
  return (
    <div className="space-y-2 px-1">
      <Name className="text-[2rem] leading-[0.9] font-extrabold tracking-[-0.01em] uppercase font-stretch-70%">
        Veritrace
      </Name>
      <p className="text-[12px] leading-4 text-muted-foreground">Hallucination-aware information assistant</p>
    </div>
  );
}

/** Model status, the explainer and the theme, pinned to the foot of the rail. */
export function SidebarFooter({ health, healthError }: { health: Health | null; healthError: string | null }) {
  return (
    <div className="mt-auto space-y-2 border-t border-border pt-3">
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

/** The bar above the thread. On phones it is black and carries the menu, the name and the model
 *  status; on wider screens it states what the next question searches. Both carry the claim panel's
 *  toggle on the right. */
export function TopBar({
  compact,
  health,
  healthError,
  scope,
  panelOpen,
  onTogglePanel,
  onOpenMenu,
}: {
  compact: boolean;
  health: Health | null;
  healthError: string | null;
  scope: string | null;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onOpenMenu: () => void;
}) {
  const toggle = (
    <Button
      variant="outline"
      size="sm"
      onClick={onTogglePanel}
      aria-expanded={panelOpen}
      aria-controls={PANEL_ID}
      className={cn(
        "h-8 gap-2 border-foreground/80 px-3 text-[13px] font-semibold",
        panelOpen && "border-signal bg-signal-soft text-signal hover:bg-signal-soft",
      )}
    >
      <PanelRightIcon className="size-4" />
      <span className="hidden sm:inline">Claim check</span>
      <span className="sr-only sm:hidden">Claim check</span>
    </Button>
  );

  if (compact) {
    return (
      <header className="dark rail-scope flex h-14 shrink-0 items-center gap-2 bg-rail px-2 text-foreground">
        <Button variant="ghost" size="icon" onClick={onOpenMenu} aria-label="Show documents and settings">
          <MenuIcon />
        </Button>
        <h1 className="text-[1.375rem] leading-none font-extrabold uppercase font-stretch-70%">Veritrace</h1>
        <div className="ml-auto flex items-center gap-1">
          <StatusDot health={health} error={healthError} />
          {toggle}
        </div>
      </header>
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-canvas px-6 lg:px-8">
      <p className="caps min-w-0 truncate text-muted-foreground">{scope}</p>
      <div className="ml-auto">{toggle}</div>
    </header>
  );
}

function statusOf(health: Health | null, error: string | null) {
  const ok = health?.status === "ok";
  return {
    // Status is never a verdict colour or the signal: a filled square when a model is serving, a
    // hollow one when it is not, a pulsing muted one while checking.
    tone: ok ? "bg-foreground" : health || error ? "border-[1.5px] border-foreground" : "bg-muted-foreground",
    label: health ? health.llm.model : error ? "Backend offline" : "Connecting…",
    short: health ? (ok ? health.llm.provider : "Unavailable") : error ? "Offline" : "Connecting",
    detail: health
      ? ok
        ? `${health.llm.provider} · ${health.llm.model}. Verifier: ${health.nli_model.split("/").pop()}.`
        : (health.llm.detail ?? "The language model is not available.")
      : (error ?? "Checking the backend."),
    sub: health ? (ok ? `${health.llm.provider} · serving` : "Model unavailable") : error ? "Start it, then reload" : null,
  };
}

function StatusDot({ health, error }: { health: Health | null; error: string | null }) {
  const status = statusOf(health, error);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex cursor-default items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <span className={cn("size-2 shrink-0", status.tone, !health && !error && "animate-pulse")} />
          {status.short}
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
        <div tabIndex={0} className="flex cursor-default items-start gap-2.5 px-1 py-1.5">
          <span className={cn("mt-1.5 size-2 shrink-0", status.tone, !health && !error && "animate-pulse")} />
          <div className="min-w-0 text-[13px] leading-5">
            <p className="truncate font-semibold">{status.label}</p>
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
    <div role="group" aria-label="Theme" className="flex items-center gap-px border border-border p-0.5">
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
                  "flex size-6 items-center justify-center text-muted-foreground transition-[background-color,color,transform] duration-150 hover:text-foreground active:scale-[0.94]",
                  active && "bg-foreground text-background hover:text-background",
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
