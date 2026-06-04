/**
 * Education mode: an interactive guided tour that runs a *real* p53 comparison
 * (AlphaFold model vs the experimental PDB) and narrates each metric with the
 * actual computed numbers — so a newcomer learns what RMSD / TM-score / lDDT /
 * pLDDT calibration mean by watching them appear on a real protein, not a toy.
 * Ends by opening the full comparison in the app. Reopenable from Learn.
 */
import { useEffect, useRef, useState } from "react";
import { runComparison } from "../api/pipeline.ts";
import { disorderedRegions, plddtSummary } from "../engine/disorder.ts";
import type { ComparisonResult } from "../engine/types.ts";
import { Icon, type IconName } from "./Icon.tsx";

const TOUR_QUERY = "P04637"; // human p53 — the canonical, well-studied example.

interface TourStep {
  icon: IconName;
  title: string;
  /** Narration, given the live result so it can quote real numbers. */
  body: (r: ComparisonResult) => React.ReactNode;
}

function num(x: number, d = 2): string {
  return x.toFixed(d);
}

/** The single most "confidently wrong" residue: high pLDDT yet high deviation. */
function confidentlyWrong(r: ComparisonResult) {
  return [...r.perResidue]
    .filter((p) => p.plddt >= 70)
    .sort((a, b) => b.deviation - a.deviation)[0];
}

const STEPS: TourStep[] = [
  {
    icon: "flask",
    title: "Meet p53 — the guardian of the genome",
    body: (r) => (
      <>
        We just compared AlphaFold's model of <strong>human p53</strong> against its best experimental structure
        (PDB <strong>{r.pdbId.toUpperCase()}</strong>), residue by residue. <strong>{r.nMatched}</strong> residues
        line up by UniProt number. Everything you're about to see was computed in your browser, just now, from real
        files. Let's read the result together.
      </>
    ),
  },
  {
    icon: "grid",
    title: "How sure was AlphaFold?",
    body: (r) => {
      const s = plddtSummary(r.perResidue.map((p) => p.plddt));
      const idrs = disorderedRegions(r.perResidue);
      return (
        <>
          Each residue carries a confidence, <strong>pLDDT</strong> (0–100). Across p53 the mean is{" "}
          <strong>{num(s.mean, 0)}</strong>, with{" "}
          <strong>{num(s.fractionConfident * 100, 0)}%</strong> of residues confident (≥70) and{" "}
          <strong>{num(s.fractionDisordered * 100, 0)}%</strong> low-confidence (&lt;50). Those low regions aren't
          mistakes — p53 has long <em>intrinsically disordered</em> stretches
          {idrs.length > 0 ? <> (the longest spans {idrs[0].length} residues)</> : null}. AlphaFold correctly tells you
          it can't pin them down.
        </>
      );
    },
  },
  {
    icon: "layers",
    title: "How well do the structures actually agree?",
    body: (r) => (
      <>
        We superpose the model onto the experiment (Kabsch) and measure the fit four ways:
        <ul className="tour-metrics">
          <li><strong>RMSD {num(r.rmsd)} Å</strong> — average atom-to-atom distance (lower is better).</li>
          <li><strong>TM-score {num(r.tmScore, 3)}</strong> — fold-level agreement; &gt;0.5 means the same fold.</li>
          <li><strong>GDT-TS {num(r.gdtTs, 1)}</strong> — % of residues within a set of distance cutoffs.</li>
          <li><strong>lDDT {num(r.lddt, 3)}</strong> — local accuracy, no superposition needed.</li>
        </ul>
        {r.tmScore > 0.5
          ? "Same fold — AlphaFold nailed the overall architecture."
          : "Different folds — worth a closer look."}
      </>
    ),
  },
  {
    icon: "beaker",
    title: "The payload: was the confidence honest?",
    body: (r) => {
      const rho = r.plddtErrorSpearman;
      return (
        <>
          Here's the scientific heart of the tool. We correlate each residue's <strong>pLDDT</strong> with its actual{" "}
          <strong>deviation</strong> from the experiment (Spearman ρ = <strong>{num(rho, 2)}</strong>). We expect{" "}
          <em>negative</em>: more confidence → less error. p53's{" "}
          {rho < -0.3 ? "clearly negative" : rho < 0 ? "mildly negative" : "non-negative"} ρ tells you the confidence
          is {rho < -0.3 ? "well-calibrated" : rho < 0 ? "roughly calibrated" : "not tracking error here"} — exactly
          the kind of check you'd report in a methods section.
        </>
      );
    },
  },
  {
    icon: "grid",
    title: "Where was it confidently wrong?",
    body: (r) => {
      const cw = confidentlyWrong(r);
      return (
        <>
          The residues that matter most are the <strong>confidently wrong</strong> ones: high pLDDT, yet far from the
          truth.{" "}
          {cw ? (
            <>
              On p53 the standout is residue <strong>{cw.uniprotNum}</strong> — pLDDT{" "}
              <strong>{num(cw.plddt, 0)}</strong> but <strong>{num(cw.deviation)} Å</strong> off. In the app the
              pLDDT-vs-deviation scatter and the 3D heatmap (blue = good, red = bad) light these up so you can inspect
              them directly.
            </>
          ) : (
            <>No high-confidence residue deviates badly here — a clean prediction.</>
          )}
        </>
      );
    },
  },
  {
    icon: "star",
    title: "Now make it yours",
    body: () => (
      <>
        That's the whole workflow: confidence → agreement → calibration → the residues that matter. Try it on{" "}
        <em>your</em> protein — fold a sequence, upload a model, or run a whole list in Batch. Star and annotate what
        you find; it all stays in your local workspace. Press <kbd>⌘K</kbd> anytime.
      </>
    ),
  },
];

export function GuidedTour({
  open,
  onClose,
  onOpenComparison,
}: {
  open: boolean;
  onClose: () => void;
  onOpenComparison: (query: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    setPhase("loading");
    runComparison(TOUR_QUERY)
      .then((data) => {
        setResult(data.result);
        setPhase("ready");
      })
      .catch((e) => {
        setError((e as Error).message);
        setPhase("error");
      });
  }, [open]);

  if (!open) return null;
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="onboard tour" onClick={(e) => e.stopPropagation()}>
        {phase === "loading" && (
          <div className="tour-loading">
            <div className="onboard-art"><Icon name="flask" size={40} /></div>
            <h2 className="onboard-title">Running a real comparison…</h2>
            <p className="onboard-body muted">
              Fetching AlphaFold's p53 model and its experimental structure, aligning by UniProt number, and computing
              every metric — live, in your browser.
            </p>
            <div className="tour-spinner" aria-hidden />
          </div>
        )}

        {phase === "error" && (
          <div className="tour-loading">
            <div className="onboard-art"><Icon name="grid" size={40} /></div>
            <h2 className="onboard-title">Couldn't load the example</h2>
            <p className="onboard-body muted">{error || "Network error."} You can still explore the app directly.</p>
            <div className="onboard-actions">
              <span />
              <button className="primary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {phase === "ready" && result && (
          <>
            <div className="onboard-art"><Icon name={s.icon} size={40} /></div>
            <div className="onboard-dots">
              {STEPS.map((_, i) => (
                <span key={i} className={`onboard-dot ${i === step ? "on" : ""}`} onClick={() => setStep(i)} />
              ))}
            </div>
            <h2 className="onboard-title">{s.title}</h2>
            <div className="onboard-body">{s.body(result)}</div>

            <div className="onboard-actions">
              <button className="link" onClick={onClose}>Close</button>
              <div className="onboard-actions-right">
                {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
                {!last ? (
                  <button className="primary" onClick={() => setStep(step + 1)}>Next</button>
                ) : (
                  <button className="primary" onClick={() => { onClose(); onOpenComparison(TOUR_QUERY); }}>
                    Open the full p53 comparison
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
