/**
 * Mol* 3D overlay (SPEC §7). Renders the experimental structure (neutral grey) and
 * the AlphaFold model superposed in the same frame, coloured by the active mode:
 *
 *   - "deviation": blue (agree) → red (disagree), in ångströms
 *   - "plddt":     blue (high confidence) → red (low confidence)
 *
 * Toggling the two is how the "confidently wrong" story reads in 3D: regions blue
 * under pLDDT but red under deviation. The AlphaFold coordinates are pre-superposed
 * and the colouring is pre-encoded into the B-factor column (see prepareModels.ts),
 * so this component only loads strings and applies Mol*'s built-in B-factor theme.
 *
 * Wrapped by ViewerErrorBoundary — if Mol* fails, the rest of the app is unaffected.
 */
import { useEffect, useRef, useState } from "react";
import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import { DefaultPluginUISpec, type PluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import type { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Color } from "molstar/lib/mol-util/color";
import "molstar/build/viewer/molstar.css";
import type { ViewerModels } from "./prepareModels.ts";

export type ColorMode = "deviation" | "plddt";

const EXP_GREY = Color(0xb8c0cc);

const SPEC: PluginUISpec = {
  ...DefaultPluginUISpec(),
  layout: { initial: { isExpanded: false, showControls: false } },
};

export function MolstarViewer({
  models,
  refText,
  refFormat,
  mode,
}: {
  models: ViewerModels;
  refText: string;
  refFormat: "pdb" | "cif";
  mode: ColorMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<PluginUIContext | null>(null);
  const [ready, setReady] = useState(false);

  // Create the plugin once (StrictMode-safe via the disposed guard).
  useEffect(() => {
    let disposed = false;
    let local: PluginUIContext | null = null;
    (async () => {
      if (!containerRef.current) return;
      const plugin = await createPluginUI({
        target: containerRef.current,
        render: renderReact18,
        spec: SPEC,
      });
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

  // (Re)load structures whenever the models or the colour mode change.
  useEffect(() => {
    const plugin = pluginRef.current;
    if (!plugin || !ready) return;
    let cancelled = false;

    (async () => {
      await plugin.clear();
      if (cancelled) return;

      // Reference structure — neutral grey.
      const expData = await plugin.builders.data.rawData({ data: refText });
      const expTraj = await plugin.builders.structure.parseTrajectory(
        expData,
        refFormat === "cif" ? "mmcif" : "pdb",
      );
      const expModel = await plugin.builders.structure.createModel(expTraj);
      const expStruct = await plugin.builders.structure.createStructure(expModel);
      await plugin.builders.structure.representation.addRepresentation(expStruct, {
        type: "cartoon",
        color: "uniform",
        colorParams: { value: EXP_GREY },
      });
      if (cancelled) return;

      // AlphaFold model — coloured by the active mode via its B-factor column.
      const afPdb = mode === "deviation" ? models.afDeviationPdb : models.afConfidencePdb;
      const domain: [number, number] = mode === "deviation" ? [0, models.maxDeviation] : [0, 100];
      const afData = await plugin.builders.data.rawData({ data: afPdb });
      const afTraj = await plugin.builders.structure.parseTrajectory(afData, "pdb");
      const afModel = await plugin.builders.structure.createModel(afTraj);
      const afStruct = await plugin.builders.structure.createStructure(afModel);
      await plugin.builders.structure.representation.addRepresentation(afStruct, {
        type: "cartoon",
        color: "uncertainty",
        colorParams: { domain },
      });
    })().catch((e) => {
      // eslint-disable-next-line no-console
      console.error("Mol* load failed:", e);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, models, refText, refFormat, mode]);

  return <div ref={containerRef} className="molstar-container" />;
}
