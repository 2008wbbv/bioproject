/**
 * Lab-facing summary: pLDDT confidence bands, agreement stats, and the table labs
 * most want — residues where the model was confident but wrong.
 */
import { plddtBands, confidentlyWrong, deviationStats, divergentRegions } from "../engine/analysis.ts";
import type { PerResidue } from "../engine/types.ts";
import { useSettings } from "../settings.tsx";

export function ConfidenceSummary({ perResidue }: { perResidue: PerResidue[] }) {
  const { settings } = useSettings();
  const bands = plddtBands(perResidue);
  const stats = deviationStats(perResidue);
  const wrong = confidentlyWrong(perResidue, { plddtMin: settings.plddtConfident, devMin: settings.deviationWrong, limit: 12 });
  const regions = divergentRegions(perResidue, { devMin: settings.deviationWrong, minLen: 3 });
  const pct = (n: number) => (bands.total ? ((n / bands.total) * 100).toFixed(0) : "0");

  return (
    <div className="summary">
      <div className="summary-grid">
        <div>
          <h3>pLDDT confidence</h3>
          <div className="band-bar" role="img" aria-label="pLDDT band distribution">
            <span className="band vhigh" style={{ width: `${pct(bands.veryHigh)}%` }} title={`Very high (>90): ${bands.veryHigh}`} />
            <span className="band conf" style={{ width: `${pct(bands.confident)}%` }} title={`Confident (70–90): ${bands.confident}`} />
            <span className="band low" style={{ width: `${pct(bands.low)}%` }} title={`Low (50–70): ${bands.low}`} />
            <span className="band vlow" style={{ width: `${pct(bands.veryLow)}%` }} title={`Very low (<50): ${bands.veryLow}`} />
          </div>
          <ul className="band-legend">
            <li><span className="dot vhigh" /> Very high &gt;90: {bands.veryHigh} ({pct(bands.veryHigh)}%)</li>
            <li><span className="dot conf" /> Confident 70–90: {bands.confident} ({pct(bands.confident)}%)</li>
            <li><span className="dot low" /> Low 50–70: {bands.low} ({pct(bands.low)}%)</li>
            <li><span className="dot vlow" /> Very low &lt;50: {bands.veryLow} ({pct(bands.veryLow)}%)</li>
          </ul>
        </div>
        <div>
          <h3>Agreement</h3>
          <ul className="stat-list">
            <li>Mean deviation: <strong>{stats.mean.toFixed(2)} Å</strong></li>
            <li>Median deviation: <strong>{stats.median.toFixed(2)} Å</strong></li>
            <li>Max deviation: <strong>{stats.max.toFixed(2)} Å</strong></li>
            <li>Within 2 Å: <strong>{(stats.fractionWithin2 * 100).toFixed(0)}%</strong></li>
          </ul>
        </div>
      </div>

      {regions.length > 0 && (
        <>
          <h3>Divergent regions ({regions.length})</h3>
          <div className="datasheet-scroll" style={{ maxHeight: 200 }}>
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Length</th>
                  <th>Mean dev (Å)</th>
                  <th>Max dev (Å)</th>
                  <th>Mean pLDDT</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={`${r.start}-${r.end}`} className={r.meanPlddt >= settings.plddtConfident ? "row-wrong" : ""}>
                    <td>{r.start}–{r.end}</td>
                    <td>{r.length}</td>
                    <td>{r.meanDeviation.toFixed(2)}</td>
                    <td>{r.maxDeviation.toFixed(2)}</td>
                    <td>{r.meanPlddt.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>Confidently wrong residues {wrong.length > 0 ? `(${wrong.length})` : ""}</h3>
      {wrong.length === 0 ? (
        <p className="muted">None — no high-confidence residue deviates beyond the threshold.</p>
      ) : (
        <div className="datasheet-scroll" style={{ maxHeight: 240 }}>
          <table>
            <thead>
              <tr>
                <th>UniProt residue</th>
                <th>pLDDT</th>
                <th>Deviation (Å)</th>
              </tr>
            </thead>
            <tbody>
              {wrong.map((r) => (
                <tr key={r.uniprotNum} className="row-wrong">
                  <td>{r.uniprotNum}</td>
                  <td>{r.plddt.toFixed(1)}</td>
                  <td>{r.deviation.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
