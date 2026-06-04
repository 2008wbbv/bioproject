/**
 * Per-secondary-structure deviation and binding-site impact. Both compute locally
 * from the cached structures (no network): SS from the model Cα geometry, binding
 * site from ligand proximity in the reference.
 */
import { useMemo } from "react";
import { parsePdb } from "../engine/parse.ts";
import { parseByFormat, type StructFormat } from "../engine/format.ts";
import { assignSecondaryStructure, deviationBySS, type SS } from "../engine/secondaryStructure.ts";
import { bindingSiteResidues, bindingSiteImpact } from "../engine/bindingSite.ts";
import type { PerResidue } from "../engine/types.ts";

const SS_COLOR: Record<SS, string> = { H: "#ef4444", E: "#eab308", C: "#94a3b8" };

export function StructuralBreakdown({
  perResidue,
  modelCaPdb,
  refText,
  refFormat,
}: {
  perResidue: PerResidue[];
  modelCaPdb: string;
  refText: string;
  refFormat: StructFormat;
}) {
  const ssRows = useMemo(() => {
    const model = parsePdb(modelCaPdb);
    const withCa = model.residues.filter((r) => r.caXyz);
    const coords = new Float64Array(withCa.length * 3);
    withCa.forEach((r, i) => {
      coords[i * 3] = r.caXyz![0];
      coords[i * 3 + 1] = r.caXyz![1];
      coords[i * 3 + 2] = r.caXyz![2];
    });
    const ss = assignSecondaryStructure(coords, withCa.length);
    const map = new Map<number, SS>();
    withCa.forEach((r, i) => map.set(r.authNum, ss[i]));
    return deviationBySS(perResidue, map);
  }, [modelCaPdb, perResidue]);

  const binding = useMemo(() => {
    const ref = parseByFormat(refText, refFormat);
    if (ref.hetAtoms.length === 0) return null;
    const site = bindingSiteResidues(ref.residues, ref.hetAtoms, 5);
    if (site.size === 0) return null;
    return bindingSiteImpact(perResidue, site);
  }, [refText, refFormat, perResidue]);

  return (
    <div className="summary">
      <h3>Secondary-structure breakdown <span className="muted small">(approx, Cα geometry)</span></h3>
      <div className="ss-rows">
        {ssRows.map((row) => (
          <div key={row.ss} className="ss-row">
            <span className="ss-chip" style={{ background: SS_COLOR[row.ss] }}>{row.label}</span>
            <span className="muted small">{row.count} residues</span>
            <div className="ss-bar">
              <div className="ss-fill" style={{ width: `${Math.min(100, row.meanDeviation * 12)}%`, background: SS_COLOR[row.ss] }} />
            </div>
            <strong>{row.meanDeviation.toFixed(2)} Å</strong>
          </div>
        ))}
      </div>

      {binding && (
        <>
          <h3 style={{ marginTop: "1.1rem" }}>Binding-site impact</h3>
          <p className="muted small">Deviation of residues near the ligand vs the rest (apo/holo confound).</p>
          <div className="ss-rows">
            <div className="ss-row">
              <span className="ss-chip" style={{ background: "#d97706" }}>Binding site</span>
              <span className="muted small">{binding.siteCount} residues</span>
              <div className="ss-bar"><div className="ss-fill" style={{ width: `${Math.min(100, binding.siteMeanDeviation * 12)}%`, background: "#d97706" }} /></div>
              <strong>{binding.siteMeanDeviation.toFixed(2)} Å</strong>
            </div>
            <div className="ss-row">
              <span className="ss-chip" style={{ background: "#0891b2" }}>Elsewhere</span>
              <span className="muted small">{binding.restCount} residues</span>
              <div className="ss-bar"><div className="ss-fill" style={{ width: `${Math.min(100, binding.restMeanDeviation * 12)}%`, background: "#0891b2" }} /></div>
              <strong>{binding.restMeanDeviation.toFixed(2)} Å</strong>
            </div>
          </div>
          {binding.siteMeanDeviation > binding.restMeanDeviation * 1.5 && binding.siteCount >= 3 && (
            <p className="muted small">The binding site deviates more than the rest — likely an apo-vs-holo difference rather than a prediction error.</p>
          )}
        </>
      )}
    </div>
  );
}
