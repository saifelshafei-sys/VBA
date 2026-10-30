---
name: openrouter-free
description: Use when the user wants a free hosted LLM, mentions OpenRouter, openrouter.ai, OPENROUTER_API_KEY, model IDs ending in ":free", "openrouter/free", or hits 429 / rate-limit / "free-model-per-day" errors from OpenRouter; also when they want a free cloud alternative to a paid model API without a local GPU.
---

# OpenRouter free models

## Overview

OpenRouter is one OpenAI-compatible API (`https://openrouter.ai/api/v1`) in front of hundreds of models. A subset is free: model IDs ending in `:free`, plus the `openrouter/free` router, which picks a free model for each request.

**Core principle:** the free list changes weekly. Never hardcode or recommend a free model from memory — query the live list, then pick.

Free means $0, not unlimited:

| Credits ever purchased | Requests/minute | Requests/day (free models) |
|---|---|---|
| Less than $10 | 20 | 50 |
| $10 or more | 20 | 1000 |

Limits from openrouter.ai/docs/api/reference/limits — re-check there if a number matters. A one-time $10 top-up raises the daily cap 20x and the credits stay usable for paid models.

## Step 1: API key

Create one at https://openrouter.ai/settings/keys and export it:
```bash
export OPENROUTER_API_KEY=sk-or-...
```
Never write the key into a file that gets committed. Check it and the remaining free quota:
```bash
curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  | jq '.data | {is_free_tier, free_model_daily_requests}'
```
401 = missing or wrong key.

## Step 2: Find free models (no key needed)

```bash
curl -s https://openrouter.ai/api/v1/models | jq -r '
  .data[] | select(.id | endswith(":free"))
  | [.id, .context_length, (if (.supported_parameters // [] | index("tools")) then "tools" else "-" end)]
  | @tsv' | sort -t$'\t' -k2 -nr
```
Columns: ID, context window, tool-calling support. Choose by the task: a `tools` model for agents and function calling, the largest context for long documents, and a model with "code" in its name or description for programming. When the user has no preference, use `openrouter/free`.

## Step 3: Call it

**curl:**
```bash
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openrouter/free",
       "messages": [{"role": "user", "content": "Why is the sky blue?"}]}' \
  | jq -r '.model, .choices[0].message.content'
```
`.model` in the response says which model actually answered. Log it, especially with `openrouter/free`.

**Python** (`pip install openai`) — existing OpenAI code only needs a new base URL and key:
```python
import os
from openai import OpenAI

client = OpenAI(base_url="https://openrouter.ai/api/v1",
                api_key=os.environ["OPENROUTER_API_KEY"])
r = client.chat.completions.create(
    model="openrouter/free",
    messages=[{"role": "user", "content": "Why is the sky blue?"}],
    # Fallbacks: if the first model is down or rate-limited, OpenRouter tries the next.
    extra_body={"models": ["google/gemma-4-31b-it:free", "openrouter/free"]},
)
print(r.model, r.choices[0].message.content)
```
The model IDs in `models` are examples. Replace them with IDs from Step 2.

## Handling failures

| Error | Cause | Fix |
|---|---|---|
| 401 | Bad or missing key | Re-export `OPENROUTER_API_KEY` |
| 402 / credit errors on a free model | Account balance below zero | Add credits to bring the balance above $0 |
| 429 | Per-minute or daily free cap hit | Check `X-RateLimit-*` headers; back off and retry for per-minute; for daily, wait for the UTC reset or top up $10 |
| 404 / "no endpoints" | Free variant was removed | Re-run Step 2 and pick another model |
| Slow or empty replies | Free providers are low priority and get overloaded | Add `models` fallbacks; set client timeout ≥ 120 s |

Retry pattern: on 429 or a 5xx error, sleep `2**attempt` seconds and retry up to 4 times. Never retry a 401.

## Privacy

Free endpoints are often run by providers that may log or train on prompts. If OpenRouter refuses free models because of your data policy, the setting is at openrouter.ai/settings/privacy. Do not send secrets, client data, or personal data to `:free` models.

## Common mistakes

| Mistake | Fix |
|---|---|
| Recommending a free model from memory | Run Step 2; yesterday's free model may be gone or paid |
| Dropping the `:free` suffix | `vendor/model` without `:free` is the paid variant and spends credits |
| Batch jobs on the 50/day tier | 50 requests runs out in minutes; top up or use Ollama locally |
| Assuming `openrouter/free` is deterministic | It routes randomly; pin an ID when outputs must be reproducible |
| Claiming success without a real call | Show the `.model` and the reply from an actual request |
