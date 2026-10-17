#!/usr/bin/env bash
# Thin CLI for the DoneBun password manager HTTP API.
# Auth: DoneBun account email + password (HTTP Basic Auth).
# See docs/password-manager.md
set -euo pipefail

SITE="${DONEBUN_SITE_URL:-${VITE_CONVEX_SITE_URL:-}}"
EMAIL="${DONEBUN_EMAIL:-${DONEBUN_USERNAME:-}}"
PASSWORD="${DONEBUN_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage:
  passwords-cli.sh list [--kind password|api_key]
  passwords-cli.sh get <id>
  passwords-cli.sh create --name NAME (--password PASS | --api-key KEY) [--kind password|api_key] [--username U] [--url URL] [--notes N]
  passwords-cli.sh update <id> [--name N] [--password P | --api-key KEY] [--kind password|api_key] [--username U] [--url URL] [--notes N]
  passwords-cli.sh delete <id>

Environment:
  DONEBUN_SITE_URL     Convex site URL (e.g. https://xxx.convex.site)
  DONEBUN_EMAIL        DoneBun account email (alias: DONEBUN_USERNAME)
  DONEBUN_PASSWORD     DoneBun account password
EOF
}

need_env() {
  if [[ -z "$SITE" ]]; then
    echo "error: set DONEBUN_SITE_URL (or VITE_CONVEX_SITE_URL)" >&2
    exit 1
  fi
  if [[ -z "$EMAIL" ]]; then
    echo "error: set DONEBUN_EMAIL (or DONEBUN_USERNAME)" >&2
    exit 1
  fi
  if [[ -z "$PASSWORD" ]]; then
    echo "error: set DONEBUN_PASSWORD" >&2
    exit 1
  fi
}

pretty() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

api() {
  local method="$1"
  local path="$2"
  shift 2
  curl -sS -X "$method" "${SITE}${path}" \
    -u "${EMAIL}:${PASSWORD}" \
    -H "Content-Type: application/json" \
    "$@"
}

CMD="${1:-}"
if [[ -z "$CMD" || "$CMD" == "-h" || "$CMD" == "--help" ]]; then
  usage
  exit 0
fi
shift || true
need_env

case "$CMD" in
  list)
    KIND=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --kind) KIND="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    if [[ -n "$KIND" && "$KIND" != "password" && "$KIND" != "api_key" ]]; then
      echo "error: --kind must be password or api_key" >&2
      exit 1
    fi
    PATH_QS="/api/passwords"
    if [[ -n "$KIND" ]]; then
      PATH_QS="/api/passwords?kind=${KIND}"
    fi
    api GET "$PATH_QS" | pretty
    ;;
  get)
    ID="${1:-}"
    [[ -n "$ID" ]] || { echo "error: id required" >&2; exit 1; }
    api GET "/api/passwords/${ID}" | pretty
    ;;
  delete)
    ID="${1:-}"
    [[ -n "$ID" ]] || { echo "error: id required" >&2; exit 1; }
    api DELETE "/api/passwords/${ID}" | pretty
    ;;
  create)
    NAME=""; PASS=""; API_KEY=""; KIND=""; USER=""; URL=""; NOTES=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --name) NAME="$2"; shift 2 ;;
        --password) PASS="$2"; shift 2 ;;
        --api-key) API_KEY="$2"; KIND="${KIND:-api_key}"; shift 2 ;;
        --kind) KIND="$2"; shift 2 ;;
        --username) USER="$2"; shift 2 ;;
        --url) URL="$2"; shift 2 ;;
        --notes) NOTES="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    [[ -n "$NAME" && ( -n "$PASS" || -n "$API_KEY" ) ]] || { echo "error: --name and --password or --api-key required" >&2; exit 1; }
    if [[ -n "$KIND" && "$KIND" != "password" && "$KIND" != "api_key" ]]; then
      echo "error: --kind must be password or api_key" >&2
      exit 1
    fi
    BODY=$(NAME="$NAME" PASS="$PASS" API_KEY="$API_KEY" KIND="$KIND" USER="$USER" URL="$URL" NOTES="$NOTES" python3 - <<'PY'
import json, os
secret = os.environ.get("PASS") or os.environ.get("API_KEY")
body = {"name": os.environ["NAME"], "password": secret}
kind = os.environ.get("KIND", "")
if kind:
    body["kind"] = kind
elif os.environ.get("API_KEY") and not os.environ.get("PASS"):
    body["kind"] = "api_key"
for key, env in [("username", "USER"), ("url", "URL"), ("notes", "NOTES")]:
    val = os.environ.get(env, "")
    if val:
        body[key] = val
print(json.dumps(body))
PY
)
    api POST /api/passwords -d "$BODY" | pretty
    ;;
  update)
    ID="${1:-}"
    [[ -n "$ID" ]] || { echo "error: id required" >&2; exit 1; }
    shift
    NAME=""; PASS=""; API_KEY=""; KIND=""; USER=""; URL=""; NOTES=""
    SET_USER=0; SET_URL=0; SET_NOTES=0
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --name) NAME="$2"; shift 2 ;;
        --password) PASS="$2"; shift 2 ;;
        --api-key) API_KEY="$2"; KIND="${KIND:-api_key}"; shift 2 ;;
        --kind) KIND="$2"; shift 2 ;;
        --username) USER="$2"; SET_USER=1; shift 2 ;;
        --url) URL="$2"; SET_URL=1; shift 2 ;;
        --notes) NOTES="$2"; SET_NOTES=1; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    if [[ -n "$KIND" && "$KIND" != "password" && "$KIND" != "api_key" ]]; then
      echo "error: --kind must be password or api_key" >&2
      exit 1
    fi
    BODY=$(NAME="$NAME" PASS="$PASS" API_KEY="$API_KEY" KIND="$KIND" USER="$USER" URL="$URL" NOTES="$NOTES" \
      SET_USER="$SET_USER" SET_URL="$SET_URL" SET_NOTES="$SET_NOTES" python3 - <<'PY'
import json, os
body = {}
if os.environ.get("NAME"):
    body["name"] = os.environ["NAME"]
secret = os.environ.get("PASS") or os.environ.get("API_KEY")
if secret:
    body["password"] = secret
kind = os.environ.get("KIND", "")
if kind:
    body["kind"] = kind
elif os.environ.get("API_KEY") and not os.environ.get("PASS"):
    body["kind"] = "api_key"
if os.environ["SET_USER"] == "1":
    body["username"] = os.environ.get("USER", "")
if os.environ["SET_URL"] == "1":
    body["url"] = os.environ.get("URL", "")
if os.environ["SET_NOTES"] == "1":
    body["notes"] = os.environ.get("NOTES", "")
if not body:
    raise SystemExit("error: provide at least one field to update")
print(json.dumps(body))
PY
)
    api PATCH "/api/passwords/${ID}" -d "$BODY" | pretty
    ;;
  *)
    echo "unknown command: $CMD" >&2
    usage
    exit 1
    ;;
esac
