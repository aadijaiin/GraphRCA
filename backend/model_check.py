"""Check which models on an OpenAI-compatible server answer quickly and can call tools, before running agents on one.

    python model_check.py                       # models matching the default filters on LOCAL_MODEL_URL
    python model_check.py glm gpt-oss qwen      # only model ids containing any of these words
    python model_check.py --models z-ai/glm-5.3 openai/gpt-oss-120b
    python model_check.py --timeout 20
    Ctrl+C skips the model being checked.

Uses LOCAL_MODEL_URL and LOCAL_MODEL_KEY (same as the local backend). Each model gets one tiny request with one
tool; a usable model replies within the timeout and calls the tool with valid JSON.

Passing is necessary, not sufficient: a 7.6B chat model passes this but cannot drive the orchestrator. Run a full
investigation on the winner. (LM Studio answers unknown model ids with whatever model is loaded.)
"""
import argparse
import json
import os
import time

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

DEFAULT_FILTERS = ["glm", "gpt-oss", "qwen3", "kimi", "deepseek", "minimax", "nemotron", "mistral"]
TOOL = {"type": "function", "function": {
    "name": "get_alert", "description": "Look up an operational alert by id.",
    "parameters": {"type": "object", "properties": {"alert_id": {"type": "string"}}, "required": ["alert_id"]}}}
PROMPT = "Look up alert ALT-001 using the get_alert tool. Do not answer in text."


def check(client, model, timeout):
    t0 = time.monotonic()
    try:
        r = client.with_options(timeout=timeout, max_retries=0).chat.completions.create(
            model=model, messages=[{"role": "user", "content": PROMPT}], tools=[TOOL], tool_choice="auto",
            max_tokens=1024, temperature=0.2)
    except OpenAIError as e:
        return f"{time.monotonic() - t0:6.1f}s  FAIL   {type(e).__name__}: {str(e)[:80]}"
    except KeyboardInterrupt:  # Ctrl+C skips a model that is hanging; Ctrl+C twice quickly to quit
        time.sleep(0.5)
        return f"{time.monotonic() - t0:6.1f}s  SKIPPED (Ctrl+C)"
    secs = time.monotonic() - t0
    calls = r.choices[0].message.tool_calls or []
    if not calls:
        return f"{secs:6.1f}s  NO TOOL CALL  replied: {(r.choices[0].message.content or '')[:60]!r}"
    try:
        args = json.loads(calls[0].function.arguments or "{}")
    except json.JSONDecodeError:
        return f"{secs:6.1f}s  BAD JSON  {calls[0].function.arguments[:60]!r}"
    ok = calls[0].function.name == "get_alert" and args.get("alert_id") == "ALT-001"
    return f"{secs:6.1f}s  {'OK' if ok else 'WRONG CALL'}     {calls[0].function.name}({args})"


def main():
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("filters", nargs="*", help="only model ids containing one of these words")
    ap.add_argument("--models", nargs="+", help="exact model ids to check (skips listing)")
    ap.add_argument("--timeout", type=float, default=30)
    args = ap.parse_args()
    url = os.getenv("LOCAL_MODEL_URL")
    if not url:
        raise SystemExit("set LOCAL_MODEL_URL (e.g. https://integrate.api.nvidia.com/v1)")
    client = OpenAI(base_url=url, api_key=os.getenv("LOCAL_MODEL_KEY") or "not-needed")
    if args.models:
        models = args.models
    else:
        words = [w.lower() for w in (args.filters or DEFAULT_FILTERS)]
        models = sorted(m.id for m in client.models.list() if any(w in m.id.lower() for w in words))
        print(f"{len(models)} models on {url} match {words}\n")
    for m in models:
        print(f"{m:<50} {check(client, m, args.timeout)}", flush=True)
    print("\nPick one marked OK, then: export LOCAL_MODEL=<id>")


if __name__ == "__main__":
    main()
