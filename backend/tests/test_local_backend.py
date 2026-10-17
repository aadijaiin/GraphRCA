"""LocalBackend (OpenAI-compatible server, e.g. self-hosted gpt-oss-20b), against a fake client: no network."""
import json
from types import SimpleNamespace

import pytest

from agents import DEPARTMENTS, Ctx, run_agent
from llm import AgentError, LocalBackend
from orchestrator import investigate
from state import Investigation
from tools import TOOLS


class Msg:
    def __init__(self, content=None, calls=()):
        self.content = content
        self.tool_calls = [SimpleNamespace(id=i, type="function", function=SimpleNamespace(name=n, arguments=a))
                           for i, n, a in calls] or None

    def model_dump(self, exclude_none=True):
        d = {"role": "assistant", "content": self.content, "reasoning": "thinking..."}
        if self.tool_calls:
            d["tool_calls"] = [{"id": t.id, "type": "function",
                                "function": {"name": t.function.name, "arguments": t.function.arguments}}
                               for t in self.tool_calls]
        return {k: v for k, v in d.items() if v is not None}


class FakeOpenAI:
    def __init__(self, replies):
        self.replies, self.requests = list(replies), []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kw):
        self.requests.append(json.loads(json.dumps(kw, default=str)))
        msg = self.replies.pop(0)
        return SimpleNamespace(choices=[SimpleNamespace(message=msg, finish_reason="tool_calls" if msg.tool_calls else "stop")])


def growth_ctx(graph, backend):
    inv = Investigation(graph, "ALT-001", backend.name)
    inv.open()
    return Ctx(graph, inv, backend, TOOLS["get_alert"](graph, alert_id="ALT-001")["result"], agent="growth",
               shared={"instructions": {}, "answer": None, "order": []})


def test_tool_loop_translates_messages(graph):
    fake = FakeOpenAI([Msg(calls=[("call_1", "find_amplifiers", '{"alert_id": "ALT-001"}')]),
                       Msg("CMP-01 Summer Coolers is active (F1).")])
    ctx = growth_ctx(graph, LocalBackend(base_url="http://x/v1", model="gpt-oss:20b", client=fake))
    assert run_agent(ctx, DEPARTMENTS["growth"], "Find amplifiers.") == "CMP-01 Summer Coolers is active (F1)."
    first, second = fake.requests
    assert first["model"] == "gpt-oss:20b" and first["messages"][0]["role"] == "system"
    assert first["tools"][0]["type"] == "function" and "strict" not in first["tools"][0]["function"]
    assistant, tool = second["messages"][2], second["messages"][3]
    assert assistant["tool_calls"][0]["id"] == "call_1" and assistant["reasoning"] == "thinking..."
    assert tool["role"] == "tool" and tool["tool_call_id"] == "call_1"
    payload = json.loads(tool["content"])
    assert payload["finding"] == "F1" and payload["result"]["campaigns"][0]["id"] == "CMP-01"


def test_bad_json_arguments_are_returned_as_error(graph):
    fake = FakeOpenAI([Msg(calls=[("c1", "find_amplifiers", '{"alert_id": ALT-001')]),
                       Msg(calls=[("c2", "find_amplifiers", '{"alert_id": "ALT-001"}')]), Msg("done")])
    ctx = growth_ctx(graph, LocalBackend(base_url="http://x/v1", client=fake))
    run_agent(ctx, DEPARTMENTS["growth"], "Find amplifiers.")
    err = json.loads(fake.requests[1]["messages"][-1]["content"])
    assert "not a valid JSON object" in err["error"]
    assert any(f["tool"] == "find_amplifiers" for f in ctx.inv.findings().values())


def test_orchestrator_reminded_to_submit(graph):
    submit = json.dumps({"summary": "Chiller.", "root_cause_id": None, "amplifier_id": None,
                         "claims": [{"text": "SD-04 promise time rose.", "finding_ids": ["F1"]}], "actions": []})
    fake = FakeOpenAI([Msg("The cause is probably the chiller."), Msg(calls=[("s1", "submit_answer", submit)])])
    answer, inv = investigate(graph, "ALT-001", LocalBackend(base_url="http://x/v1", client=fake), save_run=False)
    assert "submit_answer now" in fake.requests[1]["messages"][-1]["content"]
    assert answer["claims"][0]["text"] == "SD-04 promise time rose." and inv.model == "local:gpt-oss:20b"


def test_unreachable_server_fails_fast():
    with pytest.raises(AgentError, match="not reachable"):
        LocalBackend(base_url="http://127.0.0.1:9/v1")


def test_missing_url(monkeypatch):
    monkeypatch.delenv("LOCAL_MODEL_URL", raising=False)
    with pytest.raises(AgentError, match="LOCAL_MODEL_URL"):
        LocalBackend()


@pytest.mark.parametrize("raw,clean", [("dispatch<|channel|>commentary", "dispatch"), ("functions.find_amplifiers",
                                       "find_amplifiers"), (" find_amplifiers ", "find_amplifiers")])
def test_harmony_tokens_stripped_from_tool_names(graph, raw, clean):
    """build.nvidia.com's gpt-oss-20b returned 'dispatch<|channel|>commentary' as the tool name."""
    fake = FakeOpenAI([Msg(calls=[("c1", raw, '{"alert_id": "ALT-001"}')]), Msg("done")])
    ctx = growth_ctx(graph, LocalBackend(base_url="http://x/v1", client=fake))
    run_agent(ctx, DEPARTMENTS["growth"], "Find amplifiers.")
    replayed = fake.requests[1]["messages"][2]["tool_calls"][0]["function"]["name"]
    assert replayed == clean
    assert clean != "find_amplifiers" or any(f["tool"] == "find_amplifiers" for f in ctx.inv.findings().values())


def test_unknown_tool_error_lists_valid_tools(graph):
    fake = FakeOpenAI([Msg(calls=[("c1", "lookup_campaigns", "{}")]), Msg("done")])
    ctx = growth_ctx(graph, LocalBackend(base_url="http://x/v1", client=fake))
    run_agent(ctx, DEPARTMENTS["growth"], "Find amplifiers.")
    err = json.loads(fake.requests[1]["messages"][-1]["content"])["error"]
    assert "find_amplifiers" in err and "lookup_campaigns" in err
