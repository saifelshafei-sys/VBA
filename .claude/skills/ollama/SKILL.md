---
name: ollama
description: Use when the user wants to run, call, or test a local or free LLM through Ollama — mentions Ollama, ollama run/pull, localhost:11434, OLLAMA_HOST, a local model (llama, qwen, gemma, mistral, deepseek, phi, gpt-oss), offline/private inference, or wants a free alternative to a paid model API.
---

# Ollama

## Overview

Ollama serves open-weight models over a local HTTP API (default `http://localhost:11434`). Everything goes through that server: the CLI is a client of it, and so is any code you write.

**Core principle:** confirm where the server is *before* writing code against it. Most Ollama failures are "no server reachable from where the code runs", not API mistakes.

## Step 1: Locate the server

```bash
HOST="${OLLAMA_HOST:-http://localhost:11434}"
curl -s "$HOST/api/version"    # {"version":"..."} means it is up
curl -s "$HOST/api/tags"       # installed models
```

| Result | Meaning | Do |
|---|---|---|
| JSON version | Server up | Continue |
| Connection refused, on the user's machine | Not running | `ollama serve` (or open the Ollama app) |
| Connection refused, in a cloud/remote session or container | Ollama is on the user's computer, not here | Tell the user. Options: run the code on their machine, expose the server (`OLLAMA_HOST=0.0.0.0` + a tunnel they control), or use Ollama Cloud (below). Never claim it worked. |
| `ollama: command not found` | Not installed | Linux: `curl -fsSL https://ollama.com/install.sh \| sh`. macOS/Windows: installer from ollama.com/download |

`OLLAMA_HOST` without a scheme (e.g. `0.0.0.0:11434`) is valid for the server; prepend `http://` when using it as a client URL.

## Step 2: Make sure the model exists

```bash
ollama list                  # installed
ollama pull qwen2.5:0.5b     # download (or: curl $HOST/api/pull -d '{"model":"qwen2.5:0.5b"}')
ollama ps                    # loaded in memory right now
```

Pick a model that fits the hardware — RAM/VRAM roughly ≥ the model file size plus context:

| Hardware | Reasonable tags |
|---|---|
| CPU only / 8 GB RAM | `qwen2.5:0.5b`, `llama3.2:1b`, `gemma3:1b` |
| 16 GB RAM or 8 GB GPU | `llama3.2:3b`, `qwen2.5:7b`, `gemma3:4b` |
| 24 GB+ GPU | `qwen2.5:14b`/`32b`, `gpt-oss:20b` |

Model names are `name:tag`; omitting the tag means `:latest`. A 404 "model not found" means pull it first — the API does not auto-pull.

## Step 3: Call it

**One-shot from the shell:**
```bash
ollama run qwen2.5:0.5b "Summarize: ..."
```

**Chat API (preferred for code):**
```bash
curl -s "$HOST/api/chat" -d '{
  "model": "qwen2.5:0.5b",
  "messages": [{"role": "user", "content": "Why is the sky blue?"}],
  "stream": false
}' | jq -r .message.content
```

**Python** (`pip install ollama`):
```python
from ollama import Client
client = Client(host="http://localhost:11434")  # reads OLLAMA_HOST if omitted
reply = client.chat(
    model="qwen2.5:0.5b",
    messages=[{"role": "user", "content": "Why is the sky blue?"}],
    options={"temperature": 0.2, "num_ctx": 8192},
)
print(reply.message.content)
```

**OpenAI-compatible endpoint** — for existing OpenAI-SDK code, change only the base URL:
```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")  # key required but ignored
r = client.chat.completions.create(model="qwen2.5:0.5b",
                                   messages=[{"role": "user", "content": "hi"}])
print(r.choices[0].message.content)
```

## Quick reference

| Need | Endpoint / field |
|---|---|
| Chat | `POST /api/chat` → `.message.content` |
| Raw completion | `POST /api/generate` `{"model","prompt"}` → `.response` |
| Embeddings | `POST /api/embed` `{"model","input": str \| [str]}` → `.embeddings` |
| JSON output | `"format": "json"`, or a JSON Schema object for structured output — also say "respond in JSON" in the prompt |
| Sampling / context | `"options": {"temperature": 0.2, "num_ctx": 8192, "seed": 42}` |
| Keep model loaded | `"keep_alive": "30m"` (`0` unloads immediately) |
| Images (vision models) | `"images": ["<base64>"]` on a message |
| Tool calling | `"tools": [...]` on `/api/chat`; answer arrives in `.message.tool_calls` |
| List / delete | `GET /api/tags`, `DELETE /api/delete {"model"}` |

## Ollama Cloud (no local GPU)

Large models can run on ollama.com instead of locally. With an account and an API key from ollama.com/settings/keys:

```bash
curl -s https://ollama.com/api/chat \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -d '{"model":"gpt-oss:120b","messages":[{"role":"user","content":"hi"}],"stream":false}'
```

Same request/response shape as local. It has a free tier with usage limits; it is not unlimited. Check current limits on ollama.com before promising "free".

## Common mistakes

| Mistake | Fix |
|---|---|
| Forgetting `"stream": false` with curl | Default is streaming: one JSON object per line. Set false, or parse line by line. |
| Reading `.response` from `/api/chat` | Chat returns `.message.content`; `.response` is `/api/generate`. |
| Hardcoding `localhost` inside Docker | Use `http://host.docker.internal:11434` (Mac/Windows) or the host IP. |
| Long prompts silently truncated | Default context is small; raise `options.num_ctx`. |
| First call is slow or times out | That is model load time; set client timeouts ≥ 120 s or warm it with a short request. |
| Calling a 7B+ model on a CPU-only box | Works but is very slow; use a ≤3B model or Ollama Cloud. |
| Reporting success without running it | Run the curl from Step 1 and show its output first. |
