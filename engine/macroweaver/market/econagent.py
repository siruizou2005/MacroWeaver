"""EconAgent — labor + goods macro market (the "second config" that proves the swap).

Same agent pipeline, different mechanism. Households choose work + consumption
propensities in [0,1]; the market clears a labor market (work·skill → income →
production) and a goods market (spend → demand vs production), updates prices and wages
endogenously, and (optionally) applies progressive tax + lump-sum redistribution and a
savings interest rate. Headline series: CPI, inflation, unemployment (Phillips).
"""

from __future__ import annotations

import math

from pydantic import BaseModel, Field

from .base import AgentAction, AgentSpec, Decision, Market, MarketObservation, Outcome, register


class EconDecision(BaseModel):
    work_propensity: float = Field(default=0.7, ge=0.0, le=1.0)
    consume_propensity: float = Field(default=0.5, ge=0.0, le=1.0)
    reasoning: str = Field(default="")


# US-2018-ish progressive brackets, scaled small for the toy economy: (upper_bound, rate)
_BRACKETS = [(10.0, 0.10), (40.0, 0.18), (90.0, 0.26), (float("inf"), 0.35)]


def _progressive_tax(income: float) -> float:
    tax, lower = 0.0, 0.0
    for upper, rate in _BRACKETS:
        if income > lower:
            tax += (min(income, upper) - lower) * rate
            lower = upper
        else:
            break
    return tax


@register("econagent")
class EconAgentMarket(Market):
    granularity = "quarter"

    def _p(self, params: dict) -> dict:
        return {
            "fiscal": bool(params.get("fiscal", True)),
            "monetary": bool(params.get("monetary", True)),
            "rate": float(params.get("interest_rate", 0.01)),
            "price_k": float(params.get("price_k", 0.05)),
            "wage_k": float(params.get("wage_k", 0.04)),
            "productivity": float(params.get("productivity", 1.0)),
        }

    def init_world(self, params, agents, rng) -> dict:
        self._params = self._p(params)
        self._n = len(agents)
        skill, wealth = {}, {}
        for i, s in enumerate(agents):
            # deterministic heterogeneous skill (Pareto-ish by index), wealth from profile
            skill[s.agent_id] = float(s.profile.get("skill", 1.0 + 0.6 * ((i * 7) % 11) / 10.0))
            wealth[s.agent_id] = float(s.initial_state.get("wealth", 20.0))
        return {
            "params": self._params,
            "order": [s.agent_id for s in agents],
            "skill": skill,
            "wealth": wealth,
            "employed": {a: True for a in wealth},
            "price": 1.0,
            "prev_price": 1.0,
            "wage": 1.0,
            "production": float(len(agents)),
            "unemployment": 0.0,
            "inflation": 0.0,
        }

    def build_observation(self, state, agent_id, round_no) -> MarketObservation:
        return MarketObservation(
            public={
                "round": round_no,
                "cpi": round(state["price"] * 100, 3),
                "inflation_pct": round(state["inflation"], 3),
                "wage": round(state["wage"], 4),
                "unemployment_pct": round(state["unemployment"] * 100, 2),
                "interest_rate_pct": round(state["params"]["rate"] * 100, 2),
            },
            private={
                "wealth": round(state["wealth"][agent_id], 3),
                "skill": round(state["skill"][agent_id], 3),
                "employed": state["employed"][agent_id],
            },
        )

    def settle(self, actions, state, round_no, rng) -> tuple[list[Outcome], dict]:
        p = state["params"]
        order = state["order"]
        by_id = {a.agent_id: a for a in actions}
        price = state["price"]
        wage = state["wage"]

        # --- labor market ---
        work, income, employed = {}, {}, {}
        total_labor = 0.0
        for aid in order:
            act = by_id.get(aid)
            wp = float(act.payload.get("work", 0.7)) if act else 0.7
            wp = min(max(wp, 0.0), 1.0)
            hours = wp
            inc = hours * state["skill"][aid] * wage
            work[aid] = wp
            income[aid] = inc
            employed[aid] = wp > 0.15
            total_labor += hours * state["skill"][aid]
        production = max(1e-6, total_labor * p["productivity"])

        # --- goods market (clear demand vs production) ---
        # demand is a flow out of current income plus a little dissaving, so it scales
        # with production (avoids the stock/flow blow-up of spending a fraction of wealth)
        demand_units, want = {}, {}
        total_demand = 0.0
        for aid in order:
            act = by_id.get(aid)
            cp = float(act.payload.get("consume", 0.5)) if act else 0.5
            cp = min(max(cp, 0.0), 1.0)
            spend = cp * (income[aid] + 0.04 * state["wealth"][aid])
            du = spend / price
            want[aid] = cp
            demand_units[aid] = du
            total_demand += du
        ration = 1.0 if total_demand <= production else production / total_demand

        # --- taxes / redistribution ---
        tax = {aid: (_progressive_tax(income[aid]) if p["fiscal"] else 0.0) for aid in order}
        transfer = (sum(tax.values()) / len(order)) if p["fiscal"] else 0.0

        outcomes, nwealth = [], {}
        for aid in order:
            cons_units = demand_units[aid] * ration
            cons_value = cons_units * price
            w = state["wealth"][aid] + income[aid] - cons_value - tax[aid] + transfer
            if p["monetary"]:
                w *= 1.0 + p["rate"]
            nwealth[aid] = max(0.0, w)
            outcomes.append(Outcome(aid, {
                "income": round(income[aid], 4),
                "consumption": round(cons_value, 4),
                "tax": round(tax[aid], 4),
                "wealth": round(nwealth[aid], 4),
                "employed": employed[aid],
            }))

        # --- endogenous price + wage updates (bounded via tanh) ---
        imbalance = (total_demand - production) / production
        new_price = max(0.2, price * (1.0 + p["price_k"] * math.tanh(imbalance)))
        avg_work = sum(work.values()) / len(order)
        new_wage = max(0.2, wage * (1.0 + p["wage_k"] * math.tanh(avg_work - 0.65)))
        # Okun-ish unemployment: lower labor effort → slacker economy → more unemployment
        unemployment = min(0.35, max(0.0, 0.05 - 0.6 * (avg_work - 0.65)))
        inflation = (new_price / price - 1.0) * 100.0

        nstate = dict(state)
        nstate.update({
            "wealth": nwealth, "employed": employed, "prev_price": price,
            "price": new_price, "wage": new_wage, "production": production,
            "unemployment": unemployment, "inflation": inflation,
        })
        return outcomes, nstate

    def public_series(self, state, outcomes, round_no) -> dict:
        cpi = round(state["price"] * 100, 4)
        gdp = round(state["production"] * state["price"], 4)
        return {
            "mean_price": cpi,
            "collusion_index": 0.0,
            "inflation": round(state["inflation"], 4),
            "unemployment": round(state["unemployment"] * 100, 3),
            "wage": round(state["wage"], 4),
            "gdp": gdp,
            "by_agent_price": {"CPI": cpi},
        }

    def benchmarks(self, params: dict) -> dict:
        return {"target_cpi": 100.0}

    def decision_schema(self) -> type[BaseModel]:
        return EconDecision

    def parse_decision(self, raw: dict, agent_id: str) -> AgentAction:
        return AgentAction(agent_id, "propensity", {
            "work": float(raw.get("work_propensity", 0.7)),
            "consume": float(raw.get("consume_propensity", 0.5)),
        })

    def news_text(self, state, round_no) -> str:
        infl = state["inflation"]
        tone = "rising" if infl > 0.3 else "easing" if infl < -0.3 else "steady"
        return f"CPI {state['price']*100:.1f} · inflation {tone} ({infl:.1f}%) · unemployment {state['unemployment']*100:.0f}%"

    def heuristic(self, agent_id, obs, memory, profile, persona, round_no, rng) -> Decision:
        infl = obs.public.get("inflation_pct", 0.0)
        wealth = obs.private.get("wealth", 20.0)
        # work a bit less as wealth accumulates; supply more labor when wages bite
        work_p = 0.72 - min(0.25, wealth / 400.0) + (float(rng.random()) - 0.5) * 0.06
        # buy now when inflation is high; save more when wealthy
        consume_p = 0.86 + 0.012 * infl - min(0.2, wealth / 500.0) + (float(rng.random()) - 0.5) * 0.05
        work_p = min(max(work_p, 0.2), 1.0)
        consume_p = min(max(consume_p, 0.1), 0.98)
        if infl > 0.5:
            note = "Prices climbing — bring purchases forward and keep working."
        elif wealth > 60:
            note = "Comfortable buffer; ease off hours and save a little more."
        else:
            note = "Steady work, spend to needs, rebuild the buffer."
        return Decision(
            action=AgentAction(agent_id, "propensity", {"work": work_p, "consume": consume_p}),
            beliefs={"inflation_expectation": round(infl, 3)},
            reasoning=note,
        )
