/**
 * User-configurable analysis thresholds (persisted), shared via context so the
 * scatter quadrant, data sheet, confidence summary, and divergent-region detection
 * all use the same lab-chosen cutoffs.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Settings {
  /** pLDDT at/above which AlphaFold is "confident". */
  plddtConfident: number;
  /** Cα deviation (Å) at/above which the model is "wrong". */
  deviationWrong: number;
  /** TM-score at/above which two structures share a fold. */
  tmGood: number;
}

export const DEFAULT_SETTINGS: Settings = { plddtConfident: 70, deviationWrong: 3, tmGood: 0.5 };

const KEY = "openfoldui-settings";

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

interface Ctx {
  settings: Settings;
  setSettings: (s: Settings) => void;
  reset: () => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);
  const value = useMemo<Ctx>(
    () => ({ settings, setSettings, reset: () => setSettings(DEFAULT_SETTINGS) }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
