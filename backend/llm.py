"""Model backends for the agent runner.

Both backends take the same inputs (agent name, system prompt, tool schemas, message history) and return one
Turn: text plus zero or more tool calls. The runner executes the calls, so tools, graph writes and events are
identical whichever backend made the choice.

- ClaudeBackend: Claude via the Anthropic SDK (needs ANTHROPIC_API_KEY or another SDK credential).
- LocalBackend: any OpenAI-compatible chat-completions server (Ollama, vLLM, LM Studio, llama.cpp), e.g. a
  self-hosted gpt-oss-20b. Configured with LOCAL_MODEL_URL and LOCAL_MODEL.
- ScriptedBackend: a fixed policy per agent (scripted.py). Used by tests, offline demos and as a labelled fallback.
"""
import json
import os
from dataclasses import dataclass, field


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict


@dataclass
class Turn:
    text: str
    calls: list = field(default_factory=list)
    content: object = None  # assistant content to append to the history, unchanged


class AgentError(RuntimeError):
    pass


def has_credentials():
    """True if the Anthropic SDK can find credentials: an API key, an auth token, workload identity federation,
    or a profile saved by `ant auth login`. The client only fails at the first request, so check up front."""
    if os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_FEDERATION_RULE_ID"):
        return True
    profile = os.getenv("ANTHROPIC_PROFILE", "default")
    return os.path.exists(os.path.expanduser(f"~/.config/anthropic/credentials/{profile}.json"))


class ClaudeBackend:
    def __init__(self, model=None, effort=None, client=None):
        if client is None:
            if not has_credentials():
                raise AgentError("no Anthropic credentials: set ANTHROPIC_API_KEY or run `ant auth login`")
            import anthropic
            client = anthropic.Anthropic()
        self.client = client
        self.model = model or os.getenv("BRAIN_MODEL", "claude-opus-5-5")
        self.effort = effort or os.getenv("BRAIN_EFFORT", "medium")
        self.name = self.model

    def step(self, agent, system, tools, messages, history, ctx):
        resp = self.client.beta.messages.create(
            model=self.model,
            max_tokens=16000,
            system=system,
            tools=tools,
            messages=messages,
            output_config={"effort": self.effort},
            cache_control={"type": "ephemeral"},  # system prompt and tools are stable per agent
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",  # on a policy decline, the API retries on a fallback model in the same call
        )
        if resp.stop_reason == "refusal":
            raise AgentError(f"{agent}: model declined ({getattr(resp.stop_details, 'category', None)})")
        if resp.stop_reason == "max_tokens":
            raise AgentError(f"{agent}: response hit max_tokens")
        calls = [ToolCall(b.id, b.name, b.input) for b in resp.content if b.type == "tool_use"]
        text = "".join(b.text for b in resp.content if b.type == "text")
        return Turn(text, calls, resp.content)


def clean_tool_name(name):
    """gpt-oss speaks the harmony format; some servers leak its routing tokens into the function name
    (seen on build.nvidia.com: "dispatch<|channel|>commentary") or keep the "functions." namespace."""
    name = (name or "").split("<|", 1)[0].strip()
    return name[len("functions."):] if name.startswith("functions.") else name


def _openai_tool(t):
    return {"type": "function", "function": {"name": t["name"], "description": t["description"],
                                             "parameters": t["input_schema"]}}


def _openai_messages(system, messages):
    """The runner keeps one history shape; translate it to chat-completions messages."""
    out = [{"role": "system", "content": system}]
    for m in messages:
        c = m["content"]
        if m["role"] == "assistant" and isinstance(c, dict) and "openai" in c:
            out.append(c["openai"])
        elif m["role"] == "user" and isinstance(c, list):
            out += [{"role": "tool", "tool_call_id": b["tool_use_id"], "content": b["content"]} for b in c]
        else:
            out.append({"role": m["role"], "content": c if isinstance(c, str) else json.dumps(c, default=str)})
    return out


class LocalBackend:
    """A self-hosted model behind an OpenAI-compatible API, e.g. gpt-oss-20b on Ollama or vLLM.

    LOCAL_MODEL_URL       base URL, e.g. http://mainframe:11434/v1 (Ollama) or http://mainframe:8000/v1 (vLLM)
    LOCAL_MODEL           model name on that server (default gpt-oss:20b)
    LOCAL_MODEL_KEY       API key if the server wants one (default none)
    LOCAL_REASONING_EFFORT  low | medium | high, sent as reasoning_effort (gpt-oss supports it; unset = server default)
    LOCAL_TEMPERATURE     default 0.2;  LOCAL_MAX_TOKENS  per response, default 4096;  LOCAL_TIMEOUT  seconds, default 300
    """

    def __init__(self, base_url=None, model=None, client=None):
        self.base_url = base_url or os.getenv("LOCAL_MODEL_URL")
        self.model = model or os.getenv("LOCAL_MODEL", "gpt-oss:20b")
        self.reasoning = os.getenv("LOCAL_REASONING_EFFORT") or None
        self.temperature = float(os.getenv("LOCAL_TEMPERATURE", "0.2"))
        self.max_tokens = int(os.getenv("LOCAL_MAX_TOKENS", "4096"))
        if client is None:
            if not self.base_url:
                raise AgentError("LOCAL_MODEL_URL is not set (e.g. http://mainframe:11434/v1)")
            from openai import OpenAI, OpenAIError
            client = OpenAI(base_url=self.base_url, api_key=os.getenv("LOCAL_MODEL_KEY") or "not-needed",
                            timeout=float(os.getenv("LOCAL_TIMEOUT", "300")), max_retries=1)
            try:  # fail fast if the server is down, instead of mid-investigation
                client.with_options(timeout=5).models.list()
            except OpenAIError as e:
                raise AgentError(f"local model server at {self.base_url} is not reachable: {e}") from e
        self.client = client
        self.name = f"local:{self.model}"

    def step(self, agent, system, tools, messages, history, ctx):
        kw = dict(model=self.model, messages=_openai_messages(system, messages),
                  tools=[_openai_tool(t) for t in tools], tool_choice="auto",
                  temperature=self.temperature, max_tokens=self.max_tokens)
        if self.reasoning:
            kw["reasoning_effort"] = self.reasoning
        resp = self.client.chat.completions.create(**kw)
        choice = resp.choices[0]
        msg = choice.message
        if choice.finish_reason == "length" and not msg.tool_calls:
            raise AgentError(f"{agent}: response hit LOCAL_MAX_TOKENS ({self.max_tokens})")
        raw = msg.model_dump(exclude_none=True)  # replayed unchanged on the next turn (keeps reasoning fields)
        raw["role"] = "assistant"
        calls = []
        for i, tc in enumerate(msg.tool_calls or []):
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = None
            call_id = tc.id or f"call_{agent}_{len(history) + i:02d}"
            name = clean_tool_name(tc.function.name)
            raw["tool_calls"][i]["id"] = call_id
            raw["tool_calls"][i]["function"]["name"] = name  # replay the cleaned name, keep the history consistent
            calls.append(ToolCall(call_id, name, args if isinstance(args, dict) else None))
        return Turn(msg.content or "", calls, {"openai": raw})


class ScriptedBackend:
    name = "scripted"

    def __init__(self, policies=None):
        if policies is None:
            from scripted import POLICIES as policies
        self.policies = policies

    def step(self, agent, system, tools, messages, history, ctx):
        out = self.policies[agent](history, ctx)
        if isinstance(out, str):
            return Turn(out, [], [{"type": "text", "text": out}])
        base = len(history)
        calls = [ToolCall(f"toolu_{ctx.agent}_{base + i:02d}", name, args) for i, (name, args) in enumerate(out)]
        content = [{"type": "tool_use", "id": c.id, "name": c.name, "input": c.input} for c in calls]
        return Turn("", calls, content)


BACKENDS = {"claude": ClaudeBackend, "local": LocalBackend, "scripted": ScriptedBackend}


def default_backend():
    """BRAIN_BACKEND=claude|local|scripted if set; otherwise local when LOCAL_MODEL_URL is set, Claude when
    Anthropic credentials exist, else scripted."""
    choice = os.getenv("BRAIN_BACKEND") or (
        "local" if os.getenv("LOCAL_MODEL_URL") else "claude" if has_credentials() else "scripted")
    return BACKENDS[choice]()
