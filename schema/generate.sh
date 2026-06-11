#!/usr/bin/env bash
# Regenerate every derived artefact from the LinkML schema (DEC-57).
# The schema is the ONE source of truth; everything this script writes is
# generated output — never hand-edit it. Re-run after editing the schema.
#
# Targets: JSON Schema + TypeScript + the human-readable HTML reference.
# (Pydantic is intentionally omitted — no Python consumer yet; add gen-pydantic
# here when one appears.)
set -euo pipefail
cd "$(dirname "$0")/.."
SCHEMA=schema/remit.yaml
VENV=${LINKML_VENV:-/tmp/linkml-venv}

# LinkML installs cleanly only in a venv here — the distro pip trips on a couple
# of legacy sdists (the install_layout quirk). See docs/project_notes/bugs.md.
if [ ! -x "$VENV/bin/linkml" ] && [ ! -x "$VENV/bin/gen-json-schema" ]; then
  echo "Bootstrapping LinkML toolchain in $VENV ..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip setuptools wheel
  "$VENV/bin/pip" install --quiet linkml
fi
V="$VENV/bin"

mkdir -p schema/gen
echo "→ JSON Schema  schema/gen/remit.schema.json"
"$V/gen-json-schema" "$SCHEMA" > schema/gen/remit.schema.json
echo "→ TypeScript   schema/gen/remit.ts"
"$V/gen-typescript" "$SCHEMA" > schema/gen/remit.ts
echo "→ HTML ref     site/data-model/index.html"
"$V/python" schema/build-reference.py
echo "Done."
