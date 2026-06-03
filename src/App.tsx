/**
 * App shell. The UI (Mol* viewer, charts, batch table) is built in later phases
 * — see BUILD_PLAN.md. For now this is a placeholder so `npm run dev` works; the
 * shipped value in this milestone is the headless, fully-tested engine in
 * src/engine/.
 */
export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>AlphaFold vs Experimental</h1>
      <p>
        Compare an AlphaFold model against the best experimental structure of the same
        protein: RMSD, TM-score, GDT-TS, per-residue deviation, and the pLDDT-vs-error
        correlation that is the scientific payload of the tool.
      </p>
      <p>
        <strong>Status:</strong> engine core complete and unit-tested. UI phases are
        next — see <code>BUILD_PLAN.md</code>.
      </p>
    </main>
  );
}
