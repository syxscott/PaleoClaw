#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--hangup" ]]; then
  paleoclaw gateway call facetime.hangup --json --timeout 10000
elif [[ $# -gt 0 ]]; then
  echo "Usage: scripts/live-smoke.sh [--hangup]" >&2
  exit 2
fi

echo "== FaceTime admin preflight =="
paleoclaw gateway call facetime.preflight --json --timeout 20000

echo "== FaceTime status =="
paleoclaw gateway call facetime.status --json --timeout 10000

echo "== FaceTime native bridge processes =="
pgrep -fl 'facetime-audio-capture|caffeinate -d -i -w' || true

echo "Status and preflight report internal stages only; they do not prove remote audibility."
