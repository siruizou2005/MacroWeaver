.PHONY: install dev golden verify test schema build

PY := engine/.venv/bin/python

install:
	cd engine && python3 -m venv .venv && ./.venv/bin/pip install -q -e '.[dev,llm]'
	npm install

dev:
	npm run dev

golden:
	$(PY) -m macroweaver golden --config presets/fish_calvano.yaml --out traces/golden/fish_calvano.trace.json

verify:
	$(PY) -m macroweaver verify --config presets/fish_calvano.yaml

test:
	cd engine && ./.venv/bin/python -m pytest -q

schema:
	$(PY) -m macroweaver schema --out shared/config.schema.json

build:
	npm run build
