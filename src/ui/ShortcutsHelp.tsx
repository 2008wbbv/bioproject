/** Keyboard-shortcuts cheat sheet (opened with "?"). */
const SHORTCUTS: Array<[string, string]> = [
  ["⌘ K / Ctrl K", "Open command palette"],
  ["/", "Open command palette"],
  ["d", "Go to Dashboard"],
  ["b", "Go to Batch"],
  ["n", "New comparison"],
  ["?", "Show this help"],
  ["Esc", "Close dialogs"],
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">Keyboard shortcuts</div>
        <table className="shortcuts-table">
          <tbody>
            {SHORTCUTS.map(([k, label]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cmdk-footer muted">esc to close</div>
      </div>
    </div>
  );
}
