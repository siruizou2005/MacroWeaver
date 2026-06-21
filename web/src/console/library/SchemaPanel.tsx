import { useEffect, useState } from "react";

const serif = "'Spectral',serif";
const mono = "'Spline Sans Mono',monospace";

function typeOf(p: any): string {
  if (!p) return "any";
  if (p.type) return p.type;
  if (p.$ref) return p.$ref.split("/").pop();
  if (p.items?.$ref) return `${p.items.$ref.split("/").pop()}[]`;
  if (p.anyOf) return p.anyOf.map((x: any) => x.type || (x.$ref ? x.$ref.split("/").pop() : "null")).join(" | ");
  return "any";
}
function defOf(p: any): string {
  return p && "default" in p ? JSON.stringify(p.default) : "—";
}

function FieldTable({ properties, required = [] }: { properties: Record<string, any>; required?: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {Object.entries(properties).map(([k, p], i) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 0.9fr", gap: 12, padding: "9px 13px", background: i % 2 ? "#fbfdfb" : "#fff", fontSize: 12.5, alignItems: "center" }}>
          <span style={{ fontFamily: mono, color: "var(--green-d)", fontWeight: 600 }}>
            {k}{required.includes(k) && <span style={{ color: "var(--amber)" }}> *</span>}
          </span>
          <span style={{ fontFamily: mono, fontSize: 11.5, color: "var(--teal)" }}>{typeOf(p)}</span>
          <span style={{ fontFamily: mono, fontSize: 11.5, color: "var(--muted)" }}>{defOf(p)}</span>
        </div>
      ))}
    </div>
  );
}

export function SchemaPanel() {
  const [schema, setSchema] = useState<any>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/schema")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSchema)
      .catch(() => setErr(true));
  }, []);

  return (
    <div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.4px", margin: 0 }}>config schema</h1>
      <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--muted)", maxWidth: 680, margin: "14px 0 0" }}>
        The pydantic <span style={{ fontFamily: mono, fontSize: 14 }}>Config</span> is the contract across React ↔ Node ↔ Python. <span style={{ color: "var(--amber)" }}>*</span> marks required fields.
      </p>

      {err && <div style={{ marginTop: 28, color: "var(--muted)" }}>Schema not available — run <span style={{ fontFamily: mono }}>make schema</span> to generate it.</div>}
      {!schema && !err && <div style={{ marginTop: 28, color: "var(--muted)" }}>Loading…</div>}

      {schema && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 26, maxWidth: 720 }}>
          <section>
            <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, margin: "0 0 10px" }}>{schema.title || "Config"} <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>· root</span></h2>
            <FieldTable properties={schema.properties || {}} required={schema.required || []} />
          </section>
          {Object.entries(schema.$defs || {}).map(([name, def]: [string, any]) => (
            <section key={name}>
              <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, margin: "0 0 10px" }}>{name}</h2>
              {def.description && <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>{def.description}</p>}
              <FieldTable properties={def.properties || {}} required={def.required || []} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
