"""Model backends for the agent runner.

Both backends take the same inputs (agent name, system prompt, tool schemas, message history) and return one
Turn: text plus zero or more tool calls. The runner executes the calls, so tools, graph writes and events are
identical whichever backend made the choice.

- ClaudeBackend: Claude via the Anthropic SDK (needs ANTHROPIC_API_KEY or another SDK credential).
- ScriptedBackend: a fixed policy per agent (scripted.py). Used by tests, offline demos and as a labelled fallback.
"""
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


def default_backend():
    """Claude when a key is configured, otherwise scripted. BRAIN_BACKEND=scripted|claude overrides."""
    choice = os.getenv("BRAIN_BACKEND") or ("claude" if has_credentials() else "scripted")
    return ClaudeBackend() if choice == "claude" else ScriptedBackend()
