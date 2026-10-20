"use client";

import { MonitorIcon, MoonIcon, PanelLeftIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Health } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Header({
  health,
  healthError,
  onToggleDocuments,
}: {
  health: Health | null;
  healthError: string | null;
  onToggleDocuments: () => void;
}) {
  return (
    <header className="flex items-center gap-3 border-b bg-surface px-3 py-2.5 sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onToggleDocuments}
        aria-label="Show documents"
      >
        <PanelLeftIcon />
      </Button>
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="text-lg leading-none font-semibold tracking-tight">Veritrace</h1>
        <p className="hidden truncate text-sm text-muted-foreground sm:block">
          Answers with every claim checked against your documents
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <HealthStatus health={health} error={healthError} />
        <ThemeToggle />
      </div>
    </header>
  );
}

function HealthStatus({ health, error }: { health: Health | null; error: string | null }) {
  const ok = health?.status === "ok";
  const label = health ? health.llm.model : error ? "Backend offline" : "Connecting…";
  const detail = health
    ? ok
      ? `${health.llm.provider} · ${health.llm.model}. Verifier: ${health.nli_model.split("/").pop()}.`
      : (health.llm.detail ?? "The language model is not available.")
    : (error ?? "Checking the backend.");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              ok ? "bg-high" : health ? "bg-inferred" : error ? "bg-halluc" : "bg-muted-foreground",
            )}
          />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{detail}</TooltipContent>
    </Tooltip>
  );
}

const THEMES = [
  { value: "system", icon: MonitorIcon, label: "Use system theme" },
  { value: "light", icon: SunIcon, label: "Use light theme" },
  { value: "dark", icon: MoonIcon, label: "Use dark theme" },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The theme is only known in the browser; render the neutral icon on the server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = THEMES.findIndex((t) => t.value === (mounted ? theme : "system"));
  const next = THEMES[(current + 1) % THEMES.length];
  const Icon = THEMES[Math.max(current, 0)].icon;
  return (
    <Button variant="ghost" size="icon-sm" onClick={() => setTheme(next.value)} aria-label={next.label}>
      <Icon />
    </Button>
  );
}
