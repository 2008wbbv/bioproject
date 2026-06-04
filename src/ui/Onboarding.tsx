/**
 * First-run onboarding: a short, friendly walkthrough that introduces OpenFoldUI and
 * AlphaFold confidence, then drops the user into a real comparison or the docs.
 * Shown once (persisted); reopenable from the sidebar/Learn.
 */
import { useState } from "react";
import { Icon, type IconName } from "./Icon.tsx";

const ONBOARD_KEY = "openfoldui-onboarded";

export function hasOnboarded(): boolean {
  return localStorage.getItem(ONBOARD_KEY) === "1";
}
export function markOnboarded(): void {
  localStorage.setItem(ONBOARD_KEY, "1");
}

interface Step {
  icon: IconName;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: "flask",
    title: "Welcome to OpenFoldUI",
    body: (
      <>
        Compare a <strong>predicted</strong> protein structure — from AlphaFold, ESMFold, or your own file —
        against the best <strong>experimental</strong> structure, and see exactly where they agree and disagree.
        Everything runs in your browser; nothing is uploaded.
      </>
    ),
  },
  {
    icon: "grid",
    title: "Confidently wrong",
    body: (
      <>
        AlphaFold reports a per-residue confidence (<strong>pLDDT</strong>). The most useful thing to know is where
        the model was <em>confident but wrong</em> — high pLDDT yet far from the real structure. OpenFoldUI surfaces
        exactly those residues and regions.
      </>
    ),
  },
  {
    icon: "upload",
    title: "Your sequences and structures",
    body: (
      <>
        <strong>Fold</strong> a raw sequence with ESMFold, <strong>upload</strong> your own model + reference, or run
        a whole list in <strong>Batch</strong>. Each result lands in your workspace.
      </>
    ),
  },
  {
    icon: "star",
    title: "A real workspace",
    body: (
      <>
        Star, tag, and annotate comparisons; browse the dashboard; and export everything to Excel, CSV, JSON, or a
        full bundle — with replication logs so your analysis is reproducible. Press <kbd>⌘K</kbd> any time to jump
        around.
      </>
    ),
  },
];

export function Onboarding({
  open,
  onClose,
  onTry,
  onLearn,
}: {
  open: boolean;
  onClose: () => void;
  onTry: (query: string) => void;
  onLearn: () => void;
}) {
  const [step, setStep] = useState(0);
  if (!open) return null;
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  function finish() {
    markOnboarded();
    onClose();
  }

  return (
    <div className="cmdk-overlay" onClick={finish}>
      <div className="onboard" onClick={(e) => e.stopPropagation()}>
        <div className="onboard-art"><Icon name={s.icon} size={40} /></div>
        <div className="onboard-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`onboard-dot ${i === step ? "on" : ""}`} onClick={() => setStep(i)} />
          ))}
        </div>
        <h2 className="onboard-title">{s.title}</h2>
        <p className="onboard-body">{s.body}</p>

        <div className="onboard-actions">
          <button className="link" onClick={finish}>Skip</button>
          <div className="onboard-actions-right">
            {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
            {!last ? (
              <button className="primary" onClick={() => setStep(step + 1)}>Next</button>
            ) : (
              <>
                <button onClick={() => { markOnboarded(); onLearn(); }}>Open docs</button>
                <button className="primary" onClick={() => { markOnboarded(); onTry("P04637"); }}>Try p53</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
