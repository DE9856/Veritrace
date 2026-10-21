#!/usr/bin/env bash
# Collects the Groq evaluation, step by step. Every step resumes where it stopped, so run
# this again after Groq's daily token quota (200k per rolling 24 h) resets; it stops at
# the first step that runs out of quota. Then: python -m calibration.evaluate --write
#
#   calibration/run_groq.sh        (from backend/)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export LLM_PROVIDER=groq PYTHONWARNINGS=ignore
py=.venv/bin/python

$py -m calibration.collect_signals --claims dev_claims.yaml --out groq_dev_signals.json
$py -m calibration.rejudge groq_dev_signals.json  # claims judged before the 0.9.0 prompt
$py -m calibration.collect_signals --claims test_claims.yaml --out groq_test_signals.json
$py -m calibration.collect_signals --claims fresh_claims.yaml --out groq_fresh_signals.json
$py -m calibration.collect_answers
$py -m calibration.latency
echo "Groq collection complete. Label new claims in answer_labels.yaml, then run evaluate."
