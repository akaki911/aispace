#!/bin/bash
set -euo pipefail

PORTS=(5000 5001 5002)

log() {
  echo "[port-cleanup] $1"
}

cleanup_port() {
  local port=$1
  local pids=""

  log "Checking port ${port}"

  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "${pids}" ]; then
      log "Terminating processes via lsof: ${pids}"
      echo "${pids}" | xargs -r kill -TERM 2>/dev/null || true
      sleep 0.3
      echo "${pids}" | xargs -r kill -KILL 2>/dev/null || true
    fi
  fi

  if command -v fuser >/dev/null 2>&1; then
    log "Attempting fuser cleanup"
    fuser -k "${port}"/tcp || true
  fi

  if command -v pkill >/dev/null 2>&1 && command -v lsof >/dev/null 2>&1 && [ -z "${pids}" ]; then
    # As a fallback, try killing by command name
    pkill -f "${port}" 2>/dev/null || true
  fi
}

for port in "${PORTS[@]}"; do
  cleanup_port "${port}"
  log "Port ${port} cleanup complete"
  sleep 0.1
  log "Verification"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -ti tcp:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      log "Warning: port ${port} still appears to be in use"
    else
      log "Port ${port} is free"
    fi
  fi
  if command -v fuser >/dev/null 2>&1; then
    if fuser "${port}"/tcp >/dev/null 2>&1; then
      log "Warning: fuser reports port ${port} in use"
    else
      log "fuser reports port ${port} free"
    fi
  fi
  if ! command -v lsof >/dev/null 2>&1 && ! command -v fuser >/dev/null 2>&1; then
    log "No port inspection tools available; assuming port ${port} is clear"
  fi
  log "-----"

done

log "Port cleanup finished"
