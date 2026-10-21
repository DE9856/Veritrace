"""Confidence calibration: reliability bins, ECE, Platt scaling and selective answering."""

import pytest

from app.config import Settings
from app.verification.scoring import support_probability
from calibration import reliability as rel


def test_perfectly_calibrated_points_have_no_error():
    # Ten claims at 0.1 with one supported, ten at 0.9 with nine supported.
    points = [(0.1, i < 1) for i in range(10)] + [(0.9, i < 9) for i in range(10)]
    assert rel.ece(points) == pytest.approx(0.0)
    assert [b.count for b in rel.bins(points)] == [10, 10]


def test_underconfidence_shows_as_error():
    points = [(0.5, True)] * 10
    assert rel.ece(points) == pytest.approx(0.5)
    assert rel.brier(points) == pytest.approx(0.25)


def test_platt_fit_moves_confidence_towards_the_observed_rate():
    # Scores of 0.5 that are always right: the fitted curve maps 0.5 well above 0.5.
    points = [(0.5, True)] * 8 + [(0.0, False)] * 8
    slope, intercept = rel.fit_platt(points)
    assert rel.sigmoid(slope * 0.5 + intercept) > 0.8
    assert rel.sigmoid(intercept) < 0.2


def test_selective_answering_counts_what_is_hidden():
    points = [(0.95, True), (0.8, True), (0.6, False), (0.3, True), (0.1, False)]
    cut = rel.selective(points, 0.7)
    assert (cut.coverage, cut.risk) == (0.4, 0.0)
    assert (cut.hallucinations_shown, cut.supported_hidden) == (0, 1)
    curve = rel.risk_coverage(points)
    assert curve[0] == (0.2, 0.0) and curve[-1] == (1.0, 0.4)


def test_tied_confidences_enter_the_curve_together():
    assert rel.risk_coverage([(0.5, True), (0.5, False)]) == [(1.0, 0.5)]


def test_support_probability_is_monotone_and_never_certain():
    settings = Settings(_env_file=None)
    values = [support_probability(s / 10, settings) for s in range(11)]
    assert values == sorted(values)
    assert 0 < values[0] < 0.2 and 0.95 < values[-1] < 1


def test_figures_are_svg():
    points = [(0.1, False), (0.9, True)]
    svg = rel.reliability_svg([("Raw score", rel.bins(points))], "two claims")
    assert svg.startswith("<svg") and "perfect calibration" in svg
    coverage = rel.coverage_svg(rel.risk_coverage(points), [rel.selective(points, 0.5)], "x")
    assert "≥ 50%" in coverage
