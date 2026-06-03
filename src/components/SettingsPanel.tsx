/** A small popover to tune the analysis thresholds used across the app. */
import { useState } from "react";
import { useSettings } from "../settings.tsx";

export function SettingsPanel() {
  const { settings, setSettings, reset } = useSettings();
  const [open, setOpen] = useState(false);

  const num = (key: keyof typeof settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number.parseFloat(e.target.value);
    if (Number.isFinite(v)) setSettings({ ...settings, [key]: v });
  };

  return (
    <div className="settings">
      <button className="theme-toggle" title="Analysis thresholds" onClick={() => setOpen((v) => !v)}>
        ⚙
      </button>
      {open && (
        <div className="settings-pop">
          <h4>Analysis thresholds</h4>
          <label>
            Confident pLDDT ≥
            <input type="number" min={0} max={100} step={1} value={settings.plddtConfident} onChange={num("plddtConfident")} />
          </label>
          <label>
            "Wrong" deviation ≥ (Å)
            <input type="number" min={0} step={0.5} value={settings.deviationWrong} onChange={num("deviationWrong")} />
          </label>
          <label>
            Same-fold TM ≥
            <input type="number" min={0} max={1} step={0.05} value={settings.tmGood} onChange={num("tmGood")} />
          </label>
          <div className="settings-actions">
            <button className="link" onClick={reset}>Reset</button>
            <button onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
