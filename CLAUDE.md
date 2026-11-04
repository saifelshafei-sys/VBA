# Notes for Claude

## Tools and skills for this repo

Cloud sessions start in a fresh container. Plugins declared in
`.claude/settings.json` are not installed automatically there, so at the start
of a session that needs any of the tools below, run:

```bash
bash .claude/setup/restore-tools.sh
```

It installs:

| Tool | Kind | Use |
|---|---|---|
| `ecc@ecc` | Claude Code plugin | Declared in `.claude/settings.json`; has 2 options to set with `/plugin configure ecc@ecc` |
| `cli-anything@cli-anything` | Claude Code plugin | `/cli-anything <path-or-repo>` generates an agent-native CLI for a program |
| `cli-anything-hub` | pip package | `cli-hub list / search / install <name>` for ready-made CLIs |
| `cli-hub-meta-skill` | Skill | Also committed in `.claude/skills/`, so it loads for this repo without the script |
| `cli-anything-libreoffice` | pip package, patched | Build and export spreadsheets, documents and slides through headless LibreOffice |

Plugins installed mid-session may need `/reload-plugins` before their commands appear.

## Known issues with the LibreOffice CLI

- `cli-hub install libreoffice` fails on Debian's system setuptools
  (`AttributeError: install_layout`). The restore script builds it from source with
  `pip install --use-pep517` instead.
- Upstream (commit `34f5195`) never declares the `of:` namespace in `content.xml`, so
  every formula evaluates to `Err:510` with no error at export. The restore script
  patches `odf_utils.py`. Check exported formulas by converting the file with
  `soffice --headless --convert-to csv`; the harness's own tests don't catch this.
- It builds workbooks cell by cell from a `.lo-cli.json` project file. It does not
  open `.xlsm` files or run VBA macros.
