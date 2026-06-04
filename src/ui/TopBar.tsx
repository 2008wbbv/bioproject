/**
 * Top taskbar: sidebar toggle, breadcrumb of the current location, a command-palette
 * launcher (⌘K), settings, and the theme toggle.
 */
import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";

export function TopBar({
  breadcrumb,
  canBack,
  onBack,
  onToggleSidebar,
  onOpenPalette,
  children,
}: {
  breadcrumb: string;
  canBack: boolean;
  onBack: () => void;
  onToggleSidebar: () => void;
  onOpenPalette: () => void;
  /** Right-aligned controls (settings, theme). */
  children: ReactNode;
}) {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return (
    <header className="topbar">
      <button className="topbar-burger" title="Toggle sidebar" onClick={onToggleSidebar}><Icon name="menu" /></button>
      <button className="topbar-burger" title="Back" onClick={onBack} disabled={!canBack}><Icon name="back" /></button>
      <div className="breadcrumb">
        <span className="muted">OpenFoldUI</span>
        <span className="crumb-sep">/</span>
        <span>{breadcrumb}</span>
      </div>
      <button className="cmdk-launch" onClick={onOpenPalette}>
        <span className="muted">Search…</span>
        <kbd>{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <div className="topbar-right">{children}</div>
    </header>
  );
}
