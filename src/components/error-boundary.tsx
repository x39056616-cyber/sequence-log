"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SEQUENCE ErrorBoundary", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const error = this.state.error;
      return <div style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "#120b0b", color: "#ffd9d9", padding: 24, fontFamily: "ui-monospace, Consolas, monospace", overflow: "auto" }}>
        <h1 style={{ fontSize: 18, color: "#ff9b9b", marginBottom: 12 }}>SEQUENCE 渲染错误</h1>
        <p style={{ marginBottom: 8 }}>{error.name}: {error.message}</p>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: .85 }}>{error.stack}</pre>
        <button type="button" onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: "6px 14px", border: "1px solid #ff6b6b", background: "transparent", color: "#ffd9d9", borderRadius: 8, cursor: "pointer" }}>重试渲染</button>
      </div>;
    }
    return this.props.children;
  }
}
