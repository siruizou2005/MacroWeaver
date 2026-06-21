"""EconAgent — a faithful reproduction of Li et al. 2024 (ACL'24, "EconAgent: Large
Language Model-Empowered Agents for Simulating Macroeconomic Activities").

Ported to this engine from the authors' reference repo (github.com/tsinghua-fib-lab/
ACL24-EconAgent, built on Salesforce ai-economist). A monthly macro economy of N=100
households (no firms — the paper's `future work`). Each month a household makes two LLM
decisions in [0,1] (step 0.02): a work propensity p^w (→ l ~ Bernoulli) and a consumption
propensity p^c (the fraction of its CURRENT wealth to spend on essential goods). The
environment then clears the four reference markets, with the SAME formulas as the repo's
SimpleLabor / PeriodicBracketTax / SimpleConsumption / SimpleSaving components:

  Labor      l ~ Bernoulli(p^w); skill (hourly wage multiplier) ~ stratified Pareto clipped
             to [1, 950]; monthly salary = skill·168; working households add 168·A goods to
             the inventory G.
  Government progressive 2019 US-federal-single-filer tax (monthly brackets = annual/12) with
             lump-sum redistribution z^r = mean_j T(z_j); savings s += z − T + z^r.
  Goods      demand d_j = p^c_j·s_j / P (full current wealth); imbalance
             φ̄ = (D − G)/max(D, G) drives wage & price tâtonnement
                 skill_i ← max(1, skill_i·(1 + U(0, α_w·φ̄)))           (per agent)
                 P       ← max(1, P·(1 + U(0, α_P·φ̄)))                  (global)
             consumption settles in random order, capped by inventory: d̂_j = min(d_j, G).
  Financial  ANNUAL (every 12 months): savings earn the prevailing rate s ← s(1+r); then the
             central bank sets next year's rate by a Taylor rule on the year's price inflation
             π and unemployment u:  r = max(r^n + π^t + α_π(π−π^t) + α_u(u^n−u), 0).

Perception (name, age, city, job) comes from the reference data/profiles.json: an unemployed
household is re-offered a job drawn from its monthly-salary decile. Memory is a rolling pool
(the prompt shows the last month) plus a quarterly reflection. The decision prompt is the
paper's template (verbatim). The deterministic golden `heuristic()` reproduces the repo's
rule-based `complex_actions` baseline (work (income/(wealth·(1+r)))^γ; consumption
(price/(wealth+income))^β and a CATS variant; β=γ=0.1).

Determinism: every random draw (Pareto skill, names/ages, Bernoulli work, per-agent φ_i, the
consumption-order shuffle, annual draws) is taken from the passed-in numpy `rng`. Live mode
runs on Claude (paper used GPT-3.5-turbo-0613); set ANTHROPIC_API_KEY and policy=claude.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from pydantic import BaseModel, Field

from .base import AgentAction, AgentSpec, Decision, Market, MarketObservation, Outcome, register

_HOURS = 168.0            # num_labor_hours (21 working days × 8h)
_STEP = 0.02              # decision discretisation (paper: multiples of 0.02)
_MEMORY_WINDOW = 1        # L: months of history shown in the prompt (paper: L=1 best)
_PERIOD = 12              # months per year (annual financial settlement)

# --- reference profiles.json (names / ages / city / monthly-salary-band → job titles) ---
_PROFILES = json.loads((Path(__file__).parent / "econagent_profiles.json").read_text(encoding="utf-8"))
_NAMES = list(_PROFILES["Name"])          # 160 full names (sampled without replacement)
_AGES = list(_PROFILES["Age"])            # 200 ages 18–59 (sampled with replacement)
_CITY = _PROFILES["City"][0]              # reference fixes all agents to City[0]
# salary-band job table, keyed "lo-hi" (monthly $): 10 deciles × 10 titles
_BANDS = sorted(
    (int(k.split("-")[0]), int(k.split("-")[1]), list(v))
    for k, v in _PROFILES.items()
    if "-" in k and k.split("-")[0].isdigit()
)

# 2019 US federal single-filer brackets, scaled to MONTHLY (annual edge / 12). The reference
# stores them as np.array([0,97,394.75,842,1607.25,2041,5103])*100/12.
_EDGES = list(np.array([0, 97, 394.75, 842, 1607.25, 2041, 5103]) * 100 / 12)
_RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
# (upper_bound, marginal_rate) pairs for the progressive computation
_BRACKETS = [(_EDGES[i + 1], _RATES[i]) for i in range(len(_EDGES) - 1)] + [(float("inf"), _RATES[-1])]

_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December"]
_BASE_YEAR = 2001         # reference world_start_time = 2001.01


class EconDecision(BaseModel):
    """The paper's output: two propensities in [0,1] (multiples of 0.02)."""

    work: float = Field(default=0.5, ge=0.0, le=1.0, description="willingness/propensity to work this month, a value between 0 and 1 with intervals of 0.02")
    consumption: float = Field(default=0.5, ge=0.0, le=1.0, description="proportion of ALL your savings and income to spend on essential goods this month, a value between 0 and 1 with intervals of 0.02")
    reasoning: str = Field(default="", description="a brief note on your thinking this month (optional)")


def _progressive_tax(income: float) -> float:
    """Marginal progressive tax on a single month's income (2019 monthly brackets)."""
    tax, lower = 0.0, 0.0
    for upper, rate in _BRACKETS:
        if income <= lower:
            break
        tax += (min(income, upper) - lower) * rate
        lower = upper
    return tax


def _job_for(salary: float, rng) -> str:
    """Pick a job title from the monthly-salary decile band (reference set_offer)."""
    for lo, hi, titles in _BANDS:
        if lo <= salary <= hi:
            return str(titles[int(rng.integers(0, len(titles)))])
    last = _BANDS[-1][2]
    return str(last[int(rng.integers(0, len(last)))])


def _clip01(x: float) -> float:
    return min(max(float(x), 0.0), 1.0)


def _q(x: float) -> float:
    """Discretise a consumption propensity to the paper's grid: FLOOR to a 0..50 action
    (reference `min(max(c//0.02, 0), 50)`) then ×0.02 → a value in {0, 0.02, …, 1.0}."""
    n = min(50, max(0, int(math.floor(_clip01(x) / _STEP))))
    return round(n * _STEP, 4)


def _u0(rng, hi: float) -> float:
    """Draw uniformly between 0 and `hi` for either sign of `hi`. The reference uses legacy
    np.random.uniform(0, hi) (which allows hi<0); numpy's Generator.uniform requires low<=high,
    so flip the bounds when hi is negative — same distribution, so the tâtonnement can fall."""
    if hi > 0:
        return float(rng.uniform(0.0, hi))
    if hi < 0:
        return float(rng.uniform(hi, 0.0))
    return 0.0


@register("econagent")
class EconAgentMarket(Market):
    granularity = "month"

    # ----- params -----
    def _p(self, params: dict) -> dict:
        return {
            "A": float(params.get("productivity", 1.0)),           # goods per labor-hour
            "alpha_w": float(params.get("alpha_w", 0.05)),          # max wage inflation
            "alpha_p": float(params.get("alpha_p", 0.10)),          # max price inflation
            "r_nat": float(params.get("r_nat", 0.01)),              # natural interest rate
            "pi_target": float(params.get("pi_target", 0.02)),      # target inflation
            "u_nat": float(params.get("u_nat", 0.04)),              # natural unemployment
            "alpha_pi": float(params.get("alpha_pi", 0.5)),         # Taylor inflation gain
            "alpha_u": float(params.get("alpha_u", 0.5)),           # Taylor unemployment gain
            "pareto_shape": float(params.get("pareto_shape", 8.0)), # skill Pareto param
            "pmsm": float(params.get("pmsm", 950.0)),               # payment_max_skill_multiplier
            "tax_on": bool(params.get("fiscal", True)),             # progressive tax + transfer
            "interest_on": bool(params.get("monetary", True)),      # annual savings interest
        }

    # ----- lifecycle -----
    def init_world(self, params: dict, agents: list[AgentSpec], rng) -> dict:
        p = self._p(params)
        self._params = p
        self._n = len(agents)
        ids = [s.agent_id for s in agents]
        n = self._n

        # stratified Pareto skills (reference SimpleLabor): clip (pmsm-1)·Pareto+1 to [1, pmsm],
        # take the per-rank mean over a 1000-sample batch → a smooth sorted skill ladder.
        pmsm = p["pmsm"]
        samples = rng.pareto(p["pareto_shape"], size=(1000, n))
        clipped = np.minimum(pmsm, (pmsm - 1.0) * samples + 1.0)
        skills = np.sort(clipped, axis=1).mean(axis=0)              # ascending, length n
        skill = {aid: float(skills[i]) for i, aid in enumerate(ids)}
        # initial price = mean SAMPLED skill, fixed BEFORE per-agent trait overrides so editing one
        # agent's wage never moves the global CPI baseline (p0) that all agents normalise against.
        p0 = float(np.mean([skill[a] for a in ids]))

        # demographics from the reference profiles.json
        names = list(rng.choice(np.array(_NAMES, dtype=object), size=n, replace=(n > len(_NAMES))))
        ages = list(rng.choice(np.array(_AGES), size=n, replace=True))
        name = {aid: str(names[i]) for i, aid in enumerate(ids)}
        age = {aid: int(ages[i]) for i, aid in enumerate(ids)}
        city = {aid: _CITY for aid in ids}

        # every household starts Unemployed with a salary-decile offer (reference reset)
        job = {aid: "Unemployment" for aid in ids}
        offer = {aid: _job_for(skill[aid] * _HOURS, rng) for aid in ids}
        # each household is assigned ONE of the two reference consumption functions, once
        # (reference complex_actions: np.random.choice persisted in agent.endogenous)
        cons_fun = {aid: int(rng.integers(0, 2)) for aid in ids}

        # explicit per-agent trait overrides (materialised / edited roster): use the agent's stored
        # traits instead of the sampled values. This is deterministic and LOCAL — sampling above is
        # unchanged, so cohort-only runs (empty traits) stay byte-exact; editing/adding one agent
        # never perturbs the others.
        for s in agents:
            t = getattr(s, "traits", None) or {}
            aid = s.agent_id
            if t.get("monthly_wage") is not None:
                skill[aid] = max(1.0, float(t["monthly_wage"]) / _HOURS)
            if t.get("name") is not None:
                name[aid] = str(t["name"])
            if t.get("age") is not None:
                age[aid] = int(t["age"])
            if t.get("city") is not None:
                city[aid] = str(t["city"])
            if t.get("job"):
                offer[aid] = str(t["job"])          # at t=0 everyone is unemployed; the offer is the shown job
            if t.get("consumption_rule") is not None:
                cons_fun[aid] = 0 if str(t["consumption_rule"]).lower() == "len" else 1

        return {
            "params": p,
            "order": ids,
            "name": name, "age": age, "city": city, "job": job, "offer": offer,
            "cons_fun": cons_fun,
            "skill": skill, "prev_skill": dict(skill),
            "savings": {aid: float(s.initial_state.get("savings", 0.0)) for aid, s in zip(ids, agents)},
            "employed": {aid: False for aid in ids},
            "last_consumption": {aid: 0.0 for aid in ids},
            "last_consume_rate": {aid: 0.0 for aid in ids},
            "last_tax": {aid: 0.0 for aid in ids},
            "last_redistribution": {aid: 0.0 for aid in ids},
            "inventory": 0.0,                                       # essential-goods stock G
            "price": p0, "p0": p0, "prev_price": p0,
            "rate": p["r_nat"] + p["pi_target"],                    # reference initial rate = 0.03
            "inflation": 0.0, "unemployment": 0.0, "gdp": 0.0,
            "yr_price_sum": 0.0, "yr_unemp_sum": 0.0, "yr_months": 0, "prev_yr_avg_price": p0,
        }

    # ----- perception -----
    def build_observation(self, state: dict, agent_id: str, round_no: int) -> MarketObservation:
        skill = state["skill"][agent_id]
        expected_income = skill * _HOURS
        # direction: current skill vs last month's skill (labor-market inflation/deflation)
        prev_skill = state["prev_skill"][agent_id]
        direction = "increased" if skill >= prev_skill else "decreased"
        cpi_index = round(state["price"] / state["p0"] * 100.0, 3)
        return MarketObservation(
            public={
                "round": round_no,
                "date": self._date(round_no),
                "cpi": cpi_index,
                "price": round(state["price"], 4),
                "price_rising": state["price"] >= state["prev_price"],
                "inflation_pct": round(state["inflation"], 3),
                "unemployment_pct": round(state["unemployment"] * 100, 2),
                "interest_rate_pct": round(state["rate"] * 100, 3),
            },
            private={
                "name": state["name"][agent_id],
                "age": state["age"][agent_id],
                "city": state["city"][agent_id],
                "job": state["job"][agent_id],
                "offer": state["offer"][agent_id],
                "cons_fun": state["cons_fun"][agent_id],
                "employed_last_month": state["employed"][agent_id],
                "expected_income": round(expected_income, 2),
                "income_direction": direction,
                "savings": round(state["savings"][agent_id], 2),
                "last_consumption": round(state["last_consumption"][agent_id], 2),
                "last_consume_rate": round(state["last_consume_rate"][agent_id], 4),
                "last_tax": round(state["last_tax"][agent_id], 2),
                "last_redistribution": round(state["last_redistribution"][agent_id], 2),
            },
        )

    @staticmethod
    def _date(round_no: int) -> str:
        idx = max(0, round_no - 1)
        return f"{_BASE_YEAR + idx // 12}.{idx % 12 + 1:02d}"

    # ----- settlement (one month, in the reference component order) -----
    def settle(self, actions, state, round_no, rng) -> tuple[list[Outcome], dict]:
        p = state["params"]
        order = state["order"]
        n = len(order)
        by_id = {a.agent_id: a for a in actions}
        price = state["price"]                                     # OLD price (consumption settles here)
        skill = dict(state["skill"])
        savings = dict(state["savings"])
        work_p, cons_p = {}, {}

        # --- 1. labor market: Bernoulli work, salary, production into inventory ---
        income, worked = {}, {}
        produced = 0.0
        for aid in order:
            act = by_id.get(aid)
            wp = min(max(float(act.payload.get("work", 0.5)) if act else 0.5, 0.0), 1.0)
            cp = min(max(float(act.payload.get("consume", 0.5)) if act else 0.5, 0.0), 1.0)
            work_p[aid], cons_p[aid] = wp, cp
            l = 1.0 if float(rng.random()) < wp else 0.0
            worked[aid] = l
            income[aid] = l * skill[aid] * _HOURS
            produced += l * _HOURS * p["A"]
        supply = state["inventory"] + produced                    # last_total_products (pre-consumption)

        # --- 2. government: progressive tax + lump-sum redistribution ---
        if p["tax_on"]:
            tax = {aid: _progressive_tax(income[aid]) for aid in order}
            redistribution = sum(tax.values()) / n
        else:
            tax = {aid: 0.0 for aid in order}
            redistribution = 0.0
        for aid in order:
            savings[aid] += income[aid] - tax[aid] + redistribution   # post-tax wealth s_i

        # --- 3. goods market: demand on FULL wealth, sequential rationing at the OLD price ---
        remaining = supply
        total_demand = 0.0
        consumed_value = {}
        for idx in rng.permutation(n):
            aid = order[int(idx)]
            value = cons_p[aid] * savings[aid]                    # c_j = p^c · s_j (dollars)
            demand = value / (price + 1e-8)                       # d_j (units)
            total_demand += demand
            if remaining >= demand:
                remaining -= demand
                spent = value
            else:
                spent = remaining * price                         # rationed by inventory
                remaining = 0.0
            consumed_value[aid] = spent
            savings[aid] = max(0.0, savings[aid] - spent)
        inventory = max(0.0, remaining)

        # --- 4. supply/demand imbalance → wage & price tâtonnement (numpy U(0,x) self-signs) ---
        mcr = (total_demand - supply) / (max(total_demand, supply) + 1e-8)
        for aid in order:
            skill[aid] = max(1.0, skill[aid] * (1.0 + _u0(rng, mcr * p["alpha_w"])))
        new_price = max(1.0, price * (1.0 + _u0(rng, mcr * p["alpha_p"])))

        # --- 5. financial market: ANNUAL interest (old rate) then Taylor-rule update ---
        rate = state["rate"]
        yr_price_sum = state["yr_price_sum"] + new_price
        yr_unemp_sum = state["yr_unemp_sum"] + (sum(1.0 - worked[a] for a in order) / n)
        yr_months = state["yr_months"] + 1
        prev_yr_avg_price = state["prev_yr_avg_price"]
        if round_no % _PERIOD == 0:
            if p["interest_on"]:
                for aid in order:
                    savings[aid] *= (1.0 + rate)                  # credit the PREVAILING (old) rate
            yr_avg_price = yr_price_sum / yr_months
            yr_unemp = yr_unemp_sum / yr_months
            if round_no > _PERIOD:                                # first rate update at end of year 2
                yr_inflation = (yr_avg_price - prev_yr_avg_price) / prev_yr_avg_price if prev_yr_avg_price > 0 else 0.0
                rate = max(p["r_nat"] + p["pi_target"]
                           + p["alpha_pi"] * (yr_inflation - p["pi_target"])
                           + p["alpha_u"] * (p["u_nat"] - yr_unemp), 0.0)
            prev_yr_avg_price = yr_avg_price                      # year-N baseline (so year 2 compares vs year 1)
            yr_price_sum, yr_unemp_sum, yr_months = 0.0, 0.0, 0

        # --- 6. job stickiness / reassignment + annual ageing ---
        new_job = dict(state["job"])
        new_offer = dict(state["offer"])
        new_age = dict(state["age"])
        for aid in order:
            if worked[aid] >= 0.5:
                new_job[aid] = state["offer"][aid]                # took the offer
            else:
                new_job[aid] = "Unemployment"
                new_offer[aid] = _job_for(skill[aid] * _HOURS, rng)   # re-offer at current wage
            if round_no % _PERIOD == 1 and round_no > 1:
                new_age[aid] = state["age"][aid] + 1

        # --- monthly macro readouts ---
        inflation_pct = (new_price / price - 1.0) * 100.0 if price > 0 else 0.0
        unemployment = sum(1.0 - worked[a] for a in order) / n
        gdp = produced * price                                    # nominal output (goods · price)

        outcomes = []
        for aid in order:
            outcomes.append(Outcome(aid, {
                "work": round(work_p[aid], 4),
                "consume": round(cons_p[aid], 4),
                "employed": bool(worked[aid] >= 0.5),
                "income": round(income[aid], 4),
                "tax": round(tax[aid], 4),
                "redistribution": round(redistribution, 4),
                "consumption": round(consumed_value[aid], 4),
                "savings": round(savings[aid], 4),
                "wage": round(skill[aid] * _HOURS, 4),
                "job": new_job[aid],
            }))

        nstate = dict(state)
        nstate.update({
            "skill": skill, "prev_skill": dict(state["skill"]),
            "savings": savings,
            "employed": {aid: bool(worked[aid] >= 0.5) for aid in order},
            "job": new_job, "offer": new_offer, "age": new_age,
            "last_consumption": {aid: consumed_value[aid] for aid in order},
            "last_consume_rate": {aid: cons_p[aid] for aid in order},
            "last_tax": tax,
            "last_redistribution": {aid: redistribution for aid in order},
            "inventory": inventory,
            "prev_price": price, "price": new_price,
            "rate": rate, "inflation": inflation_pct, "unemployment": unemployment, "gdp": gdp,
            "yr_price_sum": yr_price_sum, "yr_unemp_sum": yr_unemp_sum,
            "yr_months": yr_months, "prev_yr_avg_price": prev_yr_avg_price,
        })
        return outcomes, nstate

    # ----- recorder / chart -----
    def public_series(self, state: dict, outcomes: list[Outcome], round_no: int) -> dict:
        cpi = round(state["price"] / state["p0"] * 100.0, 4)
        return {
            "mean_price": cpi,
            "collusion_index": 0.0,
            "inflation": round(state["inflation"], 4),
            "unemployment": round(state["unemployment"] * 100, 3),
            "wage": round(sum(o.realized.get("wage", 0.0) for o in outcomes) / max(1, len(outcomes)), 4),
            "interest_rate": round(state["rate"] * 100, 4),
            "gdp": round(state["gdp"], 4),
            "by_agent_price": {"CPI": cpi},
        }

    def benchmarks(self, params: dict) -> dict:
        return {"baseline": 100.0}                                # CPI index reference line

    # ----- decision schema -----
    def decision_schema(self) -> type[BaseModel]:
        return EconDecision

    def parse_decision(self, raw: dict, agent_id: str) -> AgentAction:
        # work is used RAW in the Bernoulli (reference does not snap it to 0.02); consumption is
        # floor-discretised to the 0.02 action grid.
        return AgentAction(agent_id, "propensity", {
            "work": _clip01(raw.get("work", 0.5)),
            "consume": _q(raw.get("consumption", 0.5)),
        })

    # ----- faithful LLM prompt (reference simulate.py: gpt_actions). System = the static
    # taxation explainer; user = the per-month template (name/date/job/tax/price + decision). -----
    def prompt_system(self, persona: str, profile: dict) -> str:
        return (
            "You are simulating a real person in the United States economy. As with all "
            "Americans, a portion of your monthly income is taxed by the federal government. "
            "This taxation system is tiered, income is taxed cumulatively within defined "
            "brackets, combined with a redistributive policy: after collection, the government "
            "evenly redistributes the tax revenue back to all citizens, irrespective of their "
            "earnings."
        )

    def prompt_user(self, obs: MarketObservation, memory: dict, round_no: int) -> str:
        prv, pub = obs.private, obs.public
        edges = "[" + ", ".join(f"{e:.2f}" for e in _EDGES) + "]"
        rates = "[" + ", ".join(f"{r:.2f}" for r in _RATES) + "]"
        exp_income = prv["expected_income"]

        problem = (f"You're {prv['name']}, a {prv['age']}-year-old individual living in {prv['city']}. "
                   f"Now it's {pub['date']}.")

        if not prv["employed_last_month"]:
            job = (f"In the previous month, you became unemployed and had no income. Now, you are "
                   f"invited to work as a(an) {prv['offer']} with monthly salary of ${exp_income:.2f}.")
        else:
            move = "inflation" if prv["income_direction"] == "increased" else "deflation"
            job = (f"In the previous month, you worked as a(an) {prv['job']}. If you continue working "
                   f"this month, your expected income will be ${exp_income:.2f}, which is "
                   f"{prv['income_direction']} compared to the last month due to the {move} of labor market.")

        if prv["last_consumption"] <= 0 and prv["last_consume_rate"] > 0:
            cons = "Besides, you had no consumption due to shortage of goods."
        else:
            cons = f"Besides, your consumption was ${prv['last_consumption']:.2f}."

        tax = (f"Your tax deduction amounted to ${prv['last_tax']:.2f}. However, as part of the "
               f"government's redistribution program, you received a credit of ${prv['last_redistribution']:.2f}. "
               f"In this month, the government sets the brackets: {edges} and their corresponding rates: "
               f"{rates}. Income earned within each bracket is taxed only at that bracket's rate.")

        if round_no <= 1:
            pricep = f"Meanwhile, in the consumption market, the average price of essential goods is now at ${pub['price']:.2f}."
        elif pub["price_rising"]:
            pricep = (f"Meanwhile, inflation has led to a price increase in the consumption market, with the "
                      f"average price of essential goods now at ${pub['price']:.2f}.")
        else:
            pricep = (f"Meanwhile, deflation has led to a price decrease in the consumption market, with the "
                      f"average price of essential goods now at ${pub['price']:.2f}.")

        tail = (f"Your current savings account balance is ${prv['savings']:.2f}. Interest rates, as set by "
                f"your bank, stand at {pub['interest_rate_pct']:.2f}%.")

        reflection = (memory.get("insights") or "").strip()
        refl = f"\nReflection from the previous quarter: {reflection}" if reflection else ""

        instruct = (
            "With all these factors in play, and considering aspects like your living costs, any future "
            "aspirations, and the broader economic trends, how is your willingness to work this month? "
            "Furthermore, how would you plan your expenditures on essential goods, keeping in mind good "
            "price? Please share your decisions by calling submit_decision with two keys: 'work' (a value "
            "between 0 and 1 with intervals of 0.02, indicating the willingness or propensity to work) and "
            "'consumption' (a value between 0 and 1 with intervals of 0.02, indicating the proportion of all "
            "your savings and income you intend to spend on essential goods).")

        return f"{problem} {job} {cons} {tax} {pricep} {tail}{refl}\n{instruct}"

    def news_text(self, state: dict, round_no: int) -> str:
        infl = state["inflation"]
        tone = "rising" if infl > 0.2 else "easing" if infl < -0.2 else "steady"
        return (f"CPI {state['price']/state['p0']*100:.1f} · prices {tone} ({infl:.2f}%) · "
                f"unemployment {state['unemployment']*100:.0f}% · rate {state['rate']*100:.2f}%")

    def agent_public(self, state: dict, agent_id: str) -> dict:
        # the agent's traits (EDSL-style key→value bag) shown in the console roster
        skill = state["skill"].get(agent_id, 1.0)
        job = state["job"].get(agent_id, "")
        return {
            "name": state["name"].get(agent_id, ""),
            "age": state["age"].get(agent_id, 0),
            "city": state["city"].get(agent_id, ""),
            "job": job if job and job != "Unemployment" else state["offer"].get(agent_id, ""),
            "monthly_wage": round(skill * _HOURS, 2),
            "consumption_rule": "len" if state["cons_fun"].get(agent_id, 0) == 0 else "cats",
        }

