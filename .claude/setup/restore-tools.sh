#!/usr/bin/env bash
# Reinstalls the Claude Code plugins, skills and CLIs this repo relies on.
# Cloud sessions start from a fresh container, and plugins declared in
# .claude/settings.json are NOT installed automatically there, so run this
# once per session (or call it from the environment's setup script):
#
#   bash .claude/setup/restore-tools.sh
#
# Safe to re-run; each step skips or overwrites what is already installed.
set -uo pipefail

# CLI-Anything commit the LibreOffice patch below was written and tested against.
CLI_ANYTHING_REF=34f519533bc175d2fe287ab8316b0dd99bb9cc43

step() { printf '\n==> %s\n' "$1"; }
fail=0

step "Claude Code plugins"
claude plugin marketplace add HKUDS/CLI-Anything || fail=1
claude plugin install cli-anything@cli-anything || fail=1
claude plugin marketplace add https://github.com/affaan-m/ECC.git || fail=1
claude plugin install ecc@ecc || fail=1

step "CLI-Hub package manager"
pip install -q cli-anything-hub || fail=1

step "CLI-Hub meta-skill"
# The skill also lives in .claude/skills/, which loads for this repo without
# this step; installing it globally makes it available outside the repo too.
mkdir -p "$HOME/.claude/skills/cli-hub-meta-skill"
cp "$(dirname "$0")/../skills/cli-hub-meta-skill/SKILL.md" \
   "$HOME/.claude/skills/cli-hub-meta-skill/SKILL.md" || fail=1

step "LibreOffice CLI (patched)"
# `cli-hub install libreoffice` fails on Debian's system setuptools
# (AttributeError: install_layout) and ships a bug where every formula
# evaluates to Err:510, so build it from source with the fix applied.
src=$(mktemp -d)
if git clone -q https://github.com/HKUDS/CLI-Anything.git "$src/cli-anything" &&
   git -C "$src/cli-anything" checkout -q "$CLI_ANYTHING_REF"; then
  harness="$src/cli-anything/libreoffice/agent-harness"
  python3 - "$harness/cli_anything/libreoffice/utils/odf_utils.py" <<'PY' || fail=1
import sys
path = sys.argv[1]
src = open(path, encoding="utf-8").read()
anchor = '    root.set(_nsattr("office", "version"), "1.2")\n'
fix = '    root.set("xmlns:of", "urn:oasis:names:tc:opendocument:xmlns:of:1.2")\n'
if fix not in src:
    if anchor not in src:
        sys.exit("odf_utils.py changed upstream; patch anchor not found")
    src = src.replace(anchor, anchor + fix, 1)
    open(path, "w", encoding="utf-8").write(src)
PY
  pip install -q --use-pep517 --force-reinstall --no-deps "$harness" &&
    pip install -q prompt-toolkit || fail=1
else
  fail=1
fi
rm -rf "$src"
command -v soffice >/dev/null ||
  echo "warning: LibreOffice (soffice) is not installed; the CLI needs it"

if [ "$fail" -ne 0 ]; then
  echo; echo "Some steps failed; see output above." >&2
  exit 1
fi
echo; echo "All tools restored."
