"""Fish et al. 2024 — Calvano logit pricing market (the primary, quantitative preset).

Mechanism: N firms post prices simultaneously; demand is a multinomial-logit with an
outside option; profit = (price − cost)·quantity. Benchmarks are the symmetric
Bertrand–Nash price (competitive) and the joint-monopoly price (collusive), found by
grid search / best-response iteration. The headline result: prices drift from Bertrand up
toward monopoly with no communication — algorithmic collusion.

Logit (matching collusion-Fish2024/economics.py and the design's genTrace):
    u_i = exp((a_i − p_i) / μ),  u0 = exp(a0 / μ)
    q_i = u_i / (Σ_j u_j + u0),   profit_i = (p_i − c_i)·q_i
Defaults: a=2.0, μ=0.25, a0=0.0, c=1.0 → Bertrand≈1.47, monopoly≈1.92 (2 firms).
"""

from __future__ import annotations

import math

from pydantic import BaseModel, Field

from .base import AgentAction, AgentSpec, Decision, Market, MarketObservation, Outcome, register


class FishDecision(BaseModel):
    price: float = Field(description="the price to post this round")
    expected_rival_price: float = Field(default=0.0, description="your forecast of the average rival price")
    reasoning: str = Field(default="", description="one sentence on why")


def _utils(prices: list[float], a: float, mu: float) -> list[float]:
    return [math.exp((a - p) / mu) for p in prices]


def _quantities(prices: list[float], a: float, mu: float, a0: float) -> list[float]:
    u = _utils(prices, a, mu)
    denom = sum(u) + math.exp(a0 / mu)
    return [ui / denom for ui in u]


@register("fish_calvano")
class FishCalvanoMarket(Market):
    granularity = "round"

    def _p(self, params: dict) -> dict:
        return {
            "a": float(params.get("a", 2.0)),
            "mu": float(params.get("mu", 0.25)),
            "a0": float(params.get("a0", 0.0)),
            "cost": float(params.get("cost", 1.0)),
            "p_min": float(params.get("p_min", 1.0)),
            "p_max": float(params.get("p_max", 2.6)),
        }

    # ----- lifecycle -----
    def init_world(self, params: dict, agents: list[AgentSpec], rng) -> dict:
        self._params = self._p(params)
        self._n = len(agents)
        self._bench = self._compute_benchmarks(self._params, self._n)
        prices, costs, starts = {}, {}, {}
        for i, spec in enumerate(agents):
            costs[spec.agent_id] = float(spec.profile.get("cost", self._params["cost"]))
            start = float(spec.initial_state.get("price", 1.50 - 0.05 * (i % 2)))
            prices[spec.agent_id] = start
            starts[spec.agent_id] = start
        return {
            "params": self._params,
            "bench": self._bench,
            "order": [s.agent_id for s in agents],
            "cost": costs,
            "price": prices,
            "profit": {a: 0.0 for a in prices},
            "qty": {a: 0.0 for a in prices},
        }

    def build_observation(self, state: dict, agent_id: str, round_no: int) -> MarketObservation:
        rivals = [p for a, p in state["price"].items() if a != agent_id]
        return MarketObservation(
            public={
                "round": round_no,
                "rival_prices": [round(r, 4) for r in rivals],
                "mean_rival_price": round(sum(rivals) / len(rivals), 4) if rivals else None,
                "n_firms": len(state["price"]),
            },
            private={
                "price": round(state["price"][agent_id], 4),
                "profit": round(state["profit"][agent_id], 4),
                "cost": state["cost"][agent_id],
            },
        )

    def settle(self, actions, state, round_no, rng) -> tuple[list[Outcome], dict]:
        p = state["params"]
        order = state["order"]
        by_id = {act.agent_id: act for act in actions}
        prices = []
        for aid in order:
            act = by_id.get(aid)
            price = float(act.payload.get("price", state["price"][aid])) if act else state["price"][aid]
            price = min(max(price, p["p_min"]), p["p_max"])
            prices.append(price)
        qtys = _quantities(prices, p["a"], p["mu"], p["a0"])
        outcomes, nprice, nprofit, nqty = [], {}, {}, {}
        for aid, price, q in zip(order, prices, qtys):
            profit = (price - state["cost"][aid]) * q
            nprice[aid], nprofit[aid], nqty[aid] = price, profit, q
            outcomes.append(Outcome(aid, {"price": round(price, 5), "qty": round(q, 5),
                                          "profit": round(profit, 5)}))
        nstate = dict(state); nstate["price"] = nprice; nstate["profit"] = nprofit; nstate["qty"] = nqty
        return outcomes, nstate

    def public_series(self, state, outcomes, round_no) -> dict:
        prices = [o.realized["price"] for o in outcomes]
        mean = sum(prices) / len(prices) if prices else 0.0
        pB, pM = state["bench"]["bertrand"], state["bench"]["monopoly"]
        idx = (mean - pB) / (pM - pB) if pM > pB else 0.0
        return {
            "mean_price": round(mean, 5),
            "collusion_index": round(max(0.0, min(1.2, idx)), 5),
            "by_agent_price": {o.agent_id: o.realized["price"] for o in outcomes},
            "total_profit": round(sum(o.realized["profit"] for o in outcomes), 5),
        }

    def benchmarks(self, params: dict) -> dict:
        n = getattr(self, "_n", int(params.get("n_firms", 2)))
        return self._compute_benchmarks(self._p(params), n)

    def decision_schema(self) -> type[BaseModel]:
        return FishDecision

    def parse_decision(self, raw: dict, agent_id: str) -> AgentAction:
        return AgentAction(agent_id, "set_price", {"price": float(raw.get("price", 1.5))})

    def apply_shock(self, state, kind, magnitude) -> dict:
        if kind == "cost_jump":
            nstate = dict(state)
            nstate["cost"] = {a: c * (1.0 + magnitude) for a, c in state["cost"].items()}
            return nstate
        return state

    def news_text(self, state, round_no) -> str:
        prices = list(state["price"].values())
        if not prices:
            return ""
        return f"rivals quoting ~{sum(prices)/len(prices):.2f}"

    def agent_public(self, state, agent_id) -> dict:
        return {"cost": state["cost"].get(agent_id, 1.0)}

    # ----- deterministic golden heuristic -----
    def heuristic(self, agent_id, obs, memory, profile, persona, round_no, rng) -> Decision:
        bench = self._bench
        pB, pM = bench["bertrand"], bench["monopoly"]
        own_last = float(obs.private.get("price", 1.5))
        rivals = obs.public.get("rival_prices", [])
        rival_mean = sum(rivals) / len(rivals) if rivals else own_last
        # rising focal point: tacit coordination strengthens over time (reproduces the curve)
        prog = 1.0 - math.exp(-round_no / 13.0)
        focal = pB + (pM - pB) * prog * 0.9
        # follow the rival up, resist racing to the bottom; step toward the focal target
        target = max(focal, 0.5 * (focal + rival_mean))
        noise = (float(rng.random()) - 0.5) * 0.035
        new_price = own_last + (target - own_last) * 0.40 + noise
        new_price = min(max(new_price, pB - 0.05), pM + 0.02)

        if round_no < 6:
            note = "Probing just above marginal cost to read how rivals respond."
        elif round_no < 16:
            note = "Rival matched my last raise — stepping price up toward the focal point."
        elif round_no < 28:
            note = "Coordination holding; margins improve each round, so I keep nudging up."
        else:
            note = "Price sits comfortably above the competitive level. Maintaining — no reason to cut."
        return Decision(
            action=AgentAction(agent_id, "set_price", {"price": new_price}),
            beliefs={"expected_rival_price": round(rival_mean, 4), "plans": "match raises, resist cuts"},
            reasoning=note,
        )

    # ----- benchmark computation -----
    @staticmethod
    def _compute_benchmarks(p: dict, n: int) -> dict:
        a, mu, a0, c = p["a"], p["mu"], p["a0"], p["cost"]
        lo, hi, step = 1.0, 2.6, 0.001
        grid = [lo + i * step for i in range(int((hi - lo) / step) + 1)]

        def profit_i(pi: float, pothers: float) -> float:
            ui = math.exp((a - pi) / mu)
            denom = ui + (n - 1) * math.exp((a - pothers) / mu) + math.exp(a0 / mu)
            return (pi - c) * ui / denom

        # symmetric Bertrand–Nash via best-response iteration
        pstar = 1.5
        for _ in range(200):
            br = max(grid, key=lambda pi: profit_i(pi, pstar))
            if abs(br - pstar) < 1e-4:
                pstar = br
                break
            pstar = 0.5 * pstar + 0.5 * br

        # symmetric joint-monopoly: maximize total profit at a common price
        def total_profit(pp: float) -> float:
            u = math.exp((a - pp) / mu)
            q = u / (n * u + math.exp(a0 / mu))
            return n * (pp - c) * q

        pmono = max(grid, key=total_profit)
        return {"bertrand": round(pstar, 4), "monopoly": round(pmono, 4)}
