"""CLOB — a continuous limit-order-book equity market (the TwinMarket-style financial preset).

Same agent pipeline, a third mechanism. Investors place limit buy/sell orders against a
PERSISTENT order book matched by price-time priority; a latent fair value random-walks and
fundamentalists trade toward it while momentum traders amplify trends and noise traders add
liquidity. Headline: a traded price series exhibiting stylized facts (fat-tailed returns,
volatility clustering). This is a compact self-contained book (not the binary-outcome
prediction-market engine) so the action space is plain equity buy/sell/hold.
"""

from __future__ import annotations

import math

from pydantic import BaseModel, Field

from .base import AgentAction, AgentSpec, Decision, Market, MarketObservation, Outcome, register


class ClobDecision(BaseModel):
    action: str = Field(default="hold", description="buy | sell | hold")
    price: float = Field(default=0.0, description="limit price")
    qty: int = Field(default=0, description="share quantity")
    reasoning: str = Field(default="")


def _strategy_for(spec: AgentSpec) -> str:
    s = spec.profile.get("strategy")
    if s:
        return s
    cid = spec.cohort_id.lower()
    if "fund" in cid:
        return "fundamental"
    if "mom" in cid or "trend" in cid:
        return "momentum"
    return "noise"


@register("clob")
class ClobMarket(Market):
    granularity = "session"

    def _p(self, params: dict) -> dict:
        return {
            "fair_value": float(params.get("fair_value", 100.0)),
            "tick": float(params.get("tick", 0.05)),
            "sigma": float(params.get("sigma", 0.012)),   # fair-value vol per round
            "init_cash": float(params.get("init_cash", 100_000.0)),
            "init_shares": int(params.get("init_shares", 200)),
            "max_age": int(params.get("max_age", 3)),     # rounds a resting order survives
        }

    def init_world(self, params, agents, rng) -> dict:
        self._params = self._p(params)
        self._n = len(agents)
        fv = self._params["fair_value"]
        return {
            "params": self._params,
            "order": [s.agent_id for s in agents],
            "strategy": {s.agent_id: _strategy_for(s) for s in agents},
            "cash": {s.agent_id: float(s.initial_state.get("cash", self._params["init_cash"])) for s in agents},
            "shares": {s.agent_id: int(s.initial_state.get("shares", self._params["init_shares"])) for s in agents},
            "init_wealth": {s.agent_id: self._params["init_cash"] + self._params["init_shares"] * fv for s in agents},
            "bids": [],   # list of dicts {price, seq, agent, qty, round}
            "asks": [],
            "seq": 0,
            "last_price": fv,
            "prev_price": fv,
            "fair_value": fv,
            "ret": 0.0,
        }

    def build_observation(self, state, agent_id, round_no) -> MarketObservation:
        best_bid = max((o["price"] for o in state["bids"]), default=None)
        best_ask = min((o["price"] for o in state["asks"]), default=None)
        strat = state["strategy"][agent_id]
        # fundamentalists get a noisy private estimate of fair value
        priv = {
            "cash": round(state["cash"][agent_id], 2),
            "shares": state["shares"][agent_id],
            "strategy": strat,
        }
        if strat == "fundamental":
            bias = (sum(ord(ch) for ch in agent_id) % 7) - 3  # deterministic per-agent estimate bias
            priv["fair_value_estimate"] = round(state["fair_value"] * (1 + 0.004 * bias), 3)
        return MarketObservation(
            public={
                "round": round_no,
                "last_price": round(state["last_price"], 3),
                "best_bid": round(best_bid, 3) if best_bid else None,
                "best_ask": round(best_ask, 3) if best_ask else None,
                "recent_return_pct": round(state["ret"] * 100, 3),
            },
            private=priv,
        )

    def settle(self, actions, state, round_no, rng) -> tuple[list[Outcome], dict]:
        p = state["params"]
        order = state["order"]
        cash = dict(state["cash"])
        shares = dict(state["shares"])
        bids = [dict(o) for o in state["bids"]]
        asks = [dict(o) for o in state["asks"]]
        seq = state["seq"]
        last_price = state["last_price"]
        fills = {aid: 0 for aid in order}

        # random-walk the latent fair value (kernel rng → deterministic)
        z = float(rng.standard_normal()) if hasattr(rng, "standard_normal") else (float(rng.random()) - 0.5) * 2
        fair_value = max(1.0, state["fair_value"] * math.exp(p["sigma"] * z))

        by_id = {a.agent_id: a for a in actions}
        for aid in order:
            act = by_id.get(aid)
            if not act:
                continue
            for o in act.payload.get("orders", []):
                side = o.get("side")
                price = float(o.get("price", 0))
                qty = int(o.get("qty", 0))
                if qty <= 0 or price <= 0 or side not in ("buy", "sell"):
                    continue
                seq += 1
                if side == "buy":
                    # cross against asks (lowest price first)
                    asks.sort(key=lambda x: (x["price"], x["seq"]))
                    while qty > 0 and asks and asks[0]["price"] <= price and asks[0]["agent"] != aid:
                        m = asks[0]
                        tq = min(qty, m["qty"])
                        tp = m["price"]
                        cost = tp * tq
                        if cash[aid] < cost:
                            tq = int(cash[aid] // tp)
                            if tq <= 0:
                                break
                            cost = tp * tq
                        cash[aid] -= cost; shares[aid] += tq
                        cash[m["agent"]] += cost; shares[m["agent"]] -= tq
                        fills[aid] += tq; fills[m["agent"]] += tq
                        last_price = tp; qty -= tq; m["qty"] -= tq
                        if m["qty"] <= 0:
                            asks.pop(0)
                    if qty > 0:
                        bids.append({"price": price, "seq": seq, "agent": aid, "qty": qty, "round": round_no})
                else:  # sell
                    bids.sort(key=lambda x: (-x["price"], x["seq"]))
                    while qty > 0 and bids and bids[0]["price"] >= price and bids[0]["agent"] != aid and shares[aid] > 0:
                        m = bids[0]
                        tq = min(qty, m["qty"], shares[aid])
                        tp = m["price"]
                        proceeds = tp * tq
                        cash[aid] += proceeds; shares[aid] -= tq
                        cash[m["agent"]] -= proceeds; shares[m["agent"]] += tq
                        fills[aid] += tq; fills[m["agent"]] += tq
                        last_price = tp; qty -= tq; m["qty"] -= tq
                        if m["qty"] <= 0:
                            bids.pop(0)
                    if qty > 0 and shares[aid] > 0:
                        asks.append({"price": price, "seq": seq, "agent": aid, "qty": qty, "round": round_no})

        # expire stale resting orders
        bids = [o for o in bids if round_no - o["round"] < p["max_age"]]
        asks = [o for o in asks if round_no - o["round"] < p["max_age"]]

        ret = (last_price / state["last_price"] - 1.0) if state["last_price"] else 0.0
        outcomes = []
        for aid in order:
            wealth = cash[aid] + shares[aid] * last_price
            outcomes.append(Outcome(aid, {
                "fills": fills[aid],
                "cash": round(cash[aid], 2),
                "shares": shares[aid],
                "pnl": round(wealth - state["init_wealth"][aid], 2),
                "price": round(last_price, 3),
            }))

        nstate = dict(state)
        nstate.update({
            "cash": cash, "shares": shares, "bids": bids, "asks": asks, "seq": seq,
            "prev_price": state["last_price"], "last_price": last_price,
            "fair_value": fair_value, "ret": ret,
        })
        return outcomes, nstate

    def public_series(self, state, outcomes, round_no) -> dict:
        vol = sum(o.realized["fills"] for o in outcomes) // 2
        return {
            "mean_price": round(state["last_price"], 4),
            "collusion_index": 0.0,
            "return_pct": round(state["ret"] * 100, 4),
            "volume": vol,
            "fair_value": round(state["fair_value"], 3),
            "by_agent_price": {"price": round(state["last_price"], 4), "fair value": round(state["fair_value"], 4)},
        }

    def benchmarks(self, params: dict) -> dict:
        return {}

    def decision_schema(self) -> type[BaseModel]:
        return ClobDecision

    def parse_decision(self, raw: dict, agent_id: str) -> AgentAction:
        a = raw.get("action", "hold")
        if a == "hold" or int(raw.get("qty", 0)) <= 0:
            return AgentAction(agent_id, "hold", {"orders": []})
        return AgentAction(agent_id, "order", {"orders": [
            {"side": a, "price": float(raw.get("price", 0)), "qty": int(raw.get("qty", 0))}
        ]})

    def news_text(self, state, round_no) -> str:
        d = "up" if state["ret"] > 0 else "down" if state["ret"] < 0 else "flat"
        return f"last {state['last_price']:.2f} ({state['ret']*100:+.2f}%) · tape {d}"

    def agent_public(self, state, agent_id) -> dict:
        return {"strategy": state["strategy"].get(agent_id, "noise")}

    def heuristic(self, agent_id, obs, memory, profile, persona, round_no, rng) -> Decision:
        strat = obs.private.get("strategy", "noise")
        last = obs.public.get("last_price", 100.0)
        tick = self._params["tick"]
        ret = obs.public.get("recent_return_pct", 0.0)
        qty = 1 + int(rng.integers(0, 4)) if hasattr(rng, "integers") else 1 + int(rng.random() * 4)

        # size against this agent's own recent P&L trend (BDI history) — losing → cut size,
        # winning → press a little harder, independent of which strategy is trading
        pnl_hist = [h.get("pnl", 0.0) for h in memory.get("history", [])]
        if len(pnl_hist) >= 2:
            if pnl_hist[-1] - pnl_hist[0] < -1e-6:
                qty = max(1, qty - 1)
            elif pnl_hist[-1] - pnl_hist[0] > 1e-6:
                qty += 1

        if strat == "fundamental":
            fv = obs.private.get("fair_value_estimate", last)
            if fv > last:
                side, price, note = "buy", last + tick, "Trading below fair value — bidding to accumulate."
            else:
                side, price, note = "sell", last - tick, "Above fair value — lightening into strength."
        elif strat == "momentum":
            if ret >= 0:
                side, price, note = "buy", last + 2 * tick, "Tape is up — chasing the move."
            else:
                side, price, note = "sell", last - 2 * tick, "Trend rolled over — cutting and reversing."
        else:  # noise
            up = (float(rng.random()) if not hasattr(rng, "random") else float(rng.random())) > 0.5
            side = "buy" if up else "sell"
            price = last + (tick if up else -tick) * (1 + int(rng.random() * 3))
            note = "Providing liquidity around the mid."
        price = max(tick, round(price / tick) * tick)
        return Decision(
            action=AgentAction(agent_id, "order", {"orders": [{"side": side, "price": price, "qty": qty}]}),
            beliefs={"strategy": strat, "view": side},
            reasoning=note,
        )
