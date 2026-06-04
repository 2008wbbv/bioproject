/**
 * Single-structure Mol* viewer for AlphaFold model inspection — shows one model
 * coloured by pLDDT (blue = confident, red = disordered) via the B-factor theme.
 * Isolated/error-boundaried like the comparison viewer.
 */
import { useEffect, useRef, useState } from "react";
import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import { DefaultPluginUISpec, type PluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import type { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import "molstar/build/viewer/molstar.css";
import { mapBFactor } from "../engine/pdbTransform.ts";
import { Icon } from "../ui/Icon.tsx";

const SPEC: PluginUISpec = { ...DefaultPluginUISpec(), layout: { initial: { isExpanded: false, showControls: false } } };

export function ModelViewer({ pdbText }: { pdbText: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<PluginUIContext | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let local: PluginUIContext | null = null;
    (async () => {
      if (!containerRef.current) return;
      const plugin = await createPluginUI({ target: containerRef.current, render: renderReact18, spec: SPEC });
      if (disposed) {
        plugin.dispose();
        return;
      }
      local = plugin;
      pluginRef.current = plugin;
      setReady(true);
    })();
    return () => {
      disposed = true;
      local?.dispose();
      pluginRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const plugin = pluginRef.current;
    if (!plugin || !ready) return;
    let cancelled = false;
    (async () => {
      await plugin.clear();
      if (cancelled) return;
      // B-factor = 100 - pLDDT so the uncertainty theme shows confident = blue.
      const pdb = mapBFactor(pdbText, (plddt) => 100 - plddt);
      const data = await plugin.builders.data.rawData({ data: pdb });
      const traj = await plugin.builders.structure.parseTrajectory(data, "pdb");
      const model = await plugin.builders.structure.createModel(traj);
      const struct = await plugin.builders.structure.createStructure(model);
      await plugin.builders.structure.representation.addRepresentation(struct, {
        type: "cartoon",
        color: "uncertainty",
        colorParams: { domain: [0, 100] },
      });
    })().catch((e) => console.error("Mol* model load failed:", e));
    return () => {
      cancelled = true;
    };
  }, [ready, pdbText]);

  async function screenshot() {
    const uri = await pluginRef.current?.helpers.viewportScreenshot?.getImageDataUri();
    if (!uri) return;
    const a = document.createElement("a");
    a.href = uri;
    a.download = "alphafold_model.png";
    a.click();
  }

  return (
    <div className="molstar-wrap">
      <button className="screenshot-btn" title="Save view as PNG" onClick={() => void screenshot()}>
        <Icon name="download" size={15} />
      </button>
      <div ref={containerRef} className="molstar-container" />
    </div>
  );
}
