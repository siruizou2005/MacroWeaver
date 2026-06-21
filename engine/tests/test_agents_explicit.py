"""Explicit per-agent roster (Config.agents): materialise → edit/add is local + deterministic.

The cohort is a generator; once materialised into an explicit `agents` list each agent is a
concrete, editable entry. These tests pin the invariants the console relies on: an explicit
roster reproduces the cohort sample, editing one agent changes only that agent, and adding a new
authored agent never perturbs the others (because explicit traits bypass sampling)."""

from pathlib import Path

from macroweaver.kernel.config import AgentDef, load_config
from macroweaver.kernel.runner import Runner
from macroweaver.kernel.sinks import ListSink

PRESET = Path(__file__).resolve().parents[2] / "presets" / "econagent_macro.yaml"


def _cohort_roster():
    return {a["id"]: a["traits"] for a in Runner(load_config(PRESET), ListSink()).roster()}


def _explicit(traits_by_id):
    cfg = load_config(PRESET)
    agents = [AgentDef(id=i, cohort="households", traits=t, initial_state={"savings": 0.0})
              for i, t in traits_by_id.items()]
    return Runner(cfg.model_copy(update={"agents": agents}), ListSink())


def test_explicit_agents_reproduce_cohort_roster():
    base = _cohort_roster()
    got = {a["id"]: a["traits"] for a in _explicit(base).roster()}
    assert got == base


def test_edit_one_agent_is_local():
    base = _cohort_roster()
    target = list(base)[5]
    edited = dict(base)
    edited[target] = {**base[target], "monthly_wage": 99999.0}
    got = {a["id"]: a["traits"] for a in _explicit(edited).roster()}
    assert got[target]["monthly_wage"] == 99999.0
    changed = [i for i in base if got[i] != base[i]]
    assert changed == [target], changed


def test_add_agent_does_not_perturb_others():
    base = _cohort_roster()
    cfg = load_config(PRESET)
    agents = [AgentDef(id=i, cohort="households", traits=t, initial_state={"savings": 0.0})
              for i, t in base.items()]
    agents.append(AgentDef(id="custom_0", cohort="households", initial_state={"savings": 500.0},
                           traits={"name": "Ada Custom", "age": 40, "city": "Boston",
                                   "job": "Software Engineer", "monthly_wage": 8000.0,
                                   "consumption_rule": "cats"}))
    got = {a["id"]: a["traits"] for a in Runner(cfg.model_copy(update={"agents": agents}), ListSink()).roster()}
    assert len(got) == len(base) + 1
    assert got["custom_0"]["name"] == "Ada Custom"
    assert all(got[i] == base[i] for i in base)


def test_explicit_agents_run_completes():
    base = _cohort_roster()
    runner = _explicit(base)
    runner.run(12)
    assert len(runner.recorder.series_rows) == 12


def test_editing_a_wage_does_not_move_the_price_baseline():
    # p0 (CPI baseline = mean sampled skill) must be invariant under per-agent trait edits.
    base = _cohort_roster()
    p0 = _explicit(base).state["p0"]
    target = list(base)[5]
    edited = dict(base)
    edited[target] = {**base[target], "monthly_wage": 99999.0}
    assert abs(_explicit(edited).state["p0"] - p0) < 1e-9


def test_xN_clones_are_identical_and_run():
    cfg = load_config(PRESET)
    agents = [AgentDef(id="h", cohort="households", n=3, initial_state={"savings": 0.0},
                       traits={"name": "Clone", "age": 30, "city": "X", "job": "Cashier",
                               "monthly_wage": 5000.0, "consumption_rule": "len"})]
    r = Runner(cfg.model_copy(update={"agents": agents}), ListSink())
    assert r.agent_ids == ["h#0", "h#1", "h#2"]
    tr = {a["id"]: a["traits"] for a in r.roster()}
    assert tr["h#0"] == tr["h#1"] == tr["h#2"]
    r.run(6)
    assert len(r.recorder.series_rows) == 6


def test_fish_honors_trait_cost_override():
    fish = load_config(Path(__file__).resolve().parents[2] / "presets" / "fish_calvano.yaml")
    agents = [AgentDef(id="incumbent_0", cohort="incumbent", traits={"cost": 5.0}),
              AgentDef(id="challenger_0", cohort="challenger", traits={"cost": 1.0})]
    r = Runner(fish.model_copy(update={"agents": agents}), ListSink())
    assert abs(r.state["cost"]["incumbent_0"] - 5.0) < 1e-9
    assert abs(r.state["cost"]["challenger_0"] - 1.0) < 1e-9
