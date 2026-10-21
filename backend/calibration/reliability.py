"""Is the confidence score a probability? Reliability, recalibration and selective
answering, for evaluate.py.

A claim counts as supported when its hand label is high or inferred. A well-calibrated
score of 0.8 means 8 in 10 claims scored 0.8 are supported. The score is a weighted
average of signals, not a probability, so it is mapped to one with Platt scaling:
sigmoid(slope * score + intercept), two parameters fitted on dev. Isotonic regression
fits dev better but jumps to exactly 0 and 1, a certainty 84 claims cannot support.

Selective answering: show only the claims whose chance of support is at least a
threshold, and measure how many claims are shown (coverage) and how many shown claims
are wrong (risk).
"""

import math
import random
from dataclasses import dataclass
from html import escape

BINS = 5  # equal-width score bins; the sets have 37 to 84 claims, so more bins are noise


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def fit_platt(points: list[tuple[float, bool]], steps: int = 20000) -> tuple[float, float]:
    """Logistic regression of supported on score, by gradient descent: (slope, intercept)."""
    slope, intercept = 1.0, 0.0
    for _ in range(steps):
        g_slope = g_intercept = 0.0
        for score, supported in points:
            error = sigmoid(slope * score + intercept) - supported
            g_slope += error * score
            g_intercept += error
        slope -= 0.05 * g_slope / len(points)
        intercept -= 0.05 * g_intercept / len(points)
    return slope, intercept


@dataclass
class Bin:
    low: float
    high: float
    count: int
    mean_confidence: float
    supported: float  # share of the bin's claims that are supported


def bins(points: list[tuple[float, bool]]) -> list[Bin]:
    """Group (confidence, supported) pairs into equal-width bins; empty bins are left out."""
    out = []
    for i in range(BINS):
        low, high = i / BINS, (i + 1) / BINS
        members = [p for p in points if low <= p[0] < high or (high == 1 and p[0] == 1)]
        if members:
            out.append(
                Bin(
                    low,
                    high,
                    len(members),
                    sum(c for c, _ in members) / len(members),
                    sum(s for _, s in members) / len(members),
                )
            )
    return out


def ece(points: list[tuple[float, bool]]) -> float:
    """Expected calibration error: the gap between confidence and the share supported,
    averaged over the bins, weighted by how many claims each holds."""
    return sum(b.count / len(points) * abs(b.mean_confidence - b.supported) for b in bins(points))


def brier(points: list[tuple[float, bool]]) -> float:
    return sum((c - s) ** 2 for c, s in points) / len(points)


def ece_interval(points: list[tuple[float, bool]], rounds: int = 2000) -> tuple[float, float]:
    """95% bootstrap interval of the ECE: on a few dozen claims it moves a lot."""
    rng = random.Random(0)
    values = sorted(ece(rng.choices(points, k=len(points))) for _ in range(rounds))
    return values[int(0.025 * rounds)], values[int(0.975 * rounds) - 1]


@dataclass
class Cut:
    threshold: float
    coverage: float  # share of claims shown
    risk: float  # share of shown claims that are hallucinated
    hallucinations_shown: int
    hallucinations: int
    supported_hidden: int
    supported: int


def selective(points: list[tuple[float, bool]], threshold: float) -> Cut:
    shown = [p for p in points if p[0] >= threshold]
    wrong = sum(1 for _, s in shown if not s)
    return Cut(
        threshold=threshold,
        coverage=len(shown) / len(points),
        risk=wrong / len(shown) if shown else 0.0,
        hallucinations_shown=wrong,
        hallucinations=sum(1 for _, s in points if not s),
        supported_hidden=sum(1 for c, s in points if s and c < threshold),
        supported=sum(1 for _, s in points if s),
    )


def risk_coverage(points: list[tuple[float, bool]]) -> list[tuple[float, float]]:
    """(coverage, risk) when showing the most confident claims first. Claims with equal
    confidence enter together, since no threshold can separate them."""
    ordered = sorted(points, key=lambda p: -p[0])
    curve, shown, wrong, i = [], 0, 0, 0
    while i < len(ordered):
        j = i
        while j < len(ordered) and ordered[j][0] == ordered[i][0]:
            shown += 1
            wrong += not ordered[j][1]
            j += 1
        curve.append((shown / len(points), wrong / shown))
        i = j
    return curve


# ------------------------------------------------------------------ figures
# Plain SVG, so the report needs no plotting library. Colours: the validated two-slot
# categorical pair (blue, orange), with light and dark steps; hairline grid, muted axes.

_STYLE = """
<style>
  svg { --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9;
        --axis:#c3c2b7; --s1:#2a78d6; --s2:#eb6834; font-family: system-ui, -apple-system,
        "Segoe UI", sans-serif; }
  @media (prefers-color-scheme: dark) {
    svg { --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a;
          --axis:#383835; --s1:#3987e5; --s2:#d95926; }
  }
  .bg { fill: var(--surface); } .grid { stroke: var(--grid); stroke-width: 1; }
  .axis { stroke: var(--axis); stroke-width: 1; } .ref { stroke: var(--muted); stroke-width: 1; }
  .tick { fill: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .title { fill: var(--ink); font-size: 15px; font-weight: 600; }
  .sub { fill: var(--ink2); font-size: 12px; } .label { fill: var(--ink2); font-size: 12px; }
  .s1 { stroke: var(--s1); } .s2 { stroke: var(--s2); }
  .d1 { fill: var(--s1); } .d2 { fill: var(--s2); }
  .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .dot { stroke: var(--surface); stroke-width: 2; }
</style>
"""

_W, _H = 640, 420
_L, _R, _T, _B = 56, 150, 64, 48  # plot margins; the right one holds the direct labels


def _frame(title: str, subtitle: str, x_name: str, y_name: str, y_max: float) -> list[str]:
    pw, ph = _W - _L - _R, _H - _T - _B
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_W} {_H}" width="{_W}" '
        f'height="{_H}" role="img" aria-label="{escape(title)}">',
        _STYLE,
        f'<rect class="bg" width="{_W}" height="{_H}" rx="8"/>',
        f'<text class="title" x="{_L}" y="26">{escape(title)}</text>',
        f'<text class="sub" x="{_L}" y="44">{escape(subtitle)}</text>',
    ]
    for k in range(6):
        v = k / 5
        y = _T + ph - v * ph
        out.append(f'<line class="grid" x1="{_L}" x2="{_L + pw}" y1="{y:.1f}" y2="{y:.1f}"/>')
        out.append(
            f'<text class="tick" x="{_L - 8}" y="{y + 4:.1f}" text-anchor="end">'
            f"{v * y_max:.0%}</text>"
        )
        x = _L + v * pw
        out.append(
            f'<text class="tick" x="{x:.1f}" y="{_T + ph + 18}" text-anchor="middle">{v:.0%}</text>'
        )
    out.append(f'<line class="axis" x1="{_L}" x2="{_L + pw}" y1="{_T + ph}" y2="{_T + ph}"/>')
    out.append(
        f'<text class="label" x="{_L + pw / 2}" y="{_H - 10}" text-anchor="middle">'
        f"{escape(x_name)}</text>"
    )
    out.append(
        f'<text class="label" transform="translate(16 {_T + ph / 2}) rotate(-90)" '
        f'text-anchor="middle">{escape(y_name)}</text>'
    )
    return out


def _xy(x: float, y: float, y_max: float = 1.0) -> tuple[float, float]:
    pw, ph = _W - _L - _R, _H - _T - _B
    return _L + x * pw, _T + ph - (y / y_max) * ph


def reliability_svg(series: list[tuple[str, list[Bin]]], subtitle: str) -> str:
    """Reliability diagram: per bin, mean confidence against the share supported. The
    diagonal is perfect calibration; points above it are underconfident."""
    out = _frame(
        "Confidence against reality", subtitle, "Stated confidence", "Claims supported", 1.0
    )
    x0, y0 = _xy(0, 0)
    x1, y1 = _xy(1, 1)
    out.append(f'<line class="ref" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}"/>')
    # Name the diagonal just below its far end, where no bin can sit.
    lx, ly = _xy(0.97, 0.97)
    out.append(
        f'<text class="tick" x="{lx}" y="{ly + 18}" text-anchor="end">perfect calibration</text>'
    )
    for n, (name, points) in enumerate(series, 1):
        coords = [_xy(b.mean_confidence, b.supported) for b in points]
        path = " ".join(f"{x:.1f},{y:.1f}" for x, y in coords)
        out.append(f'<polyline class="line s{n}" points="{path}"/>')
        for b, (x, y) in zip(points, coords, strict=True):
            tip = (
                f"{name}: {b.count} claims scored {b.low:.1f}-{b.high:.1f}, mean confidence "
                f"{b.mean_confidence:.0%}, {b.supported:.0%} supported"
            )
            out.append(
                f'<circle class="dot d{n}" cx="{x:.1f}" cy="{y:.1f}" r="5">'
                f"<title>{escape(tip)}</title></circle>"
            )
        out.append(
            f'<circle class="d{n}" cx="{_W - _R + 18}" cy="{_T + 8 + (n - 1) * 22}" r="5"/>'
            f'<text class="label" x="{_W - _R + 30}" y="{_T + 12 + (n - 1) * 22}">'
            f"{escape(name)}</text>"
        )
    out.append("</svg>")
    return "\n".join(out) + "\n"


def coverage_svg(curve: list[tuple[float, float]], cuts: list[Cut], subtitle: str) -> str:
    """Risk-coverage curve: showing fewer claims (most confident first) shows fewer wrong
    ones. The marked points are the thresholds in the report's table."""
    y_max = max(0.5, math.ceil(max(r for _, r in curve) * 10) / 10)
    out = _frame(
        "Hiding uncertain claims",
        subtitle,
        "Claims shown (most confident first)",
        "Shown claims that are hallucinated",
        y_max,
    )
    coords = [_xy(c, r, y_max) for c, r in curve]
    path = " ".join(f"{x:.1f},{y:.1f}" for x, y in coords)
    out.append(f'<polyline class="line s1" points="{path}"/>')
    # Thresholds that land close together share one label instead of overprinting.
    groups: list[list[Cut]] = []
    for cut in sorted(cuts, key=lambda c: c.coverage):
        if groups and cut.coverage - groups[-1][-1].coverage < 0.08:
            groups[-1].append(cut)
        else:
            groups.append([cut])
    for group in groups:
        for cut in group:
            x, y = _xy(cut.coverage, cut.risk, y_max)
            tip = (
                f"Chance of support at least {cut.threshold:.0%}: {cut.coverage:.0%} of claims "
                f"shown, {cut.risk:.0%} of them hallucinated"
            )
            out.append(
                f'<circle class="dot d1" cx="{x:.1f}" cy="{y:.1f}" r="5">'
                f"<title>{escape(tip)}</title></circle>"
            )
        x, y = _xy(group[0].coverage, group[0].risk, y_max)
        names = ", ".join(f"{c.threshold:.0%}" for c in sorted(group, key=lambda c: c.threshold))
        out.append(f'<text class="label" x="{x:.1f}" y="{y - 12:.1f}">≥ {names}</text>')
    out.append("</svg>")
    return "\n".join(out) + "\n"
