/**
 * Isolates the Mol* viewer (SPEC §7). Mol* is heavy and pulls in WebGL; if it fails
 * to initialise or render, the boundary keeps the rest of the app — metrics, charts,
 * the scientific payload — fully usable.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
}

export class ViewerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Mol* viewer error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="viewer-error">
            <p>The 3D viewer failed to load.</p>
            <p className="muted">{this.state.error.message}</p>
            <p className="muted">The metrics and charts above are unaffected.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
