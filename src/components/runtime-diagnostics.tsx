"use client";

import { useEffect, useState } from "react";

interface DiagEntry {
  kind: string;
  message: string;
  at: string;
}

export function RuntimeDiagnostics() {
  const [entries, setEntries] = useState<DiagEntry[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const push = (kind: string, message: string) => {
      setEntries((prev) => {
        if (prev.some((item) => item.kind === kind && item.message === message)) return prev;
        return [...prev, { kind, message, at: new Date().toLocaleTimeString() }].slice(-6);
      });
    };
    const onError = (event: ErrorEvent) => push("运行时错误", event.message + (event.filename ? " @ " + event.filename + ":" + event.lineno : ""));
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      push("未捕获 Promise", reason instanceof Error ? reason.message + "\n" + (reason.stack ?? "") : String(reason));
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (anchor) push("点击链接", anchor.getAttribute("href") ?? "(none)");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!entries.length || hidden) return null;

  return <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 2147483647, background: "rgba(30,0,0,.95)", color: "#ffd9d9", border: "1px solid #ff6b6b", borderRadius: 10, padding: "10px 12px", fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, lineHeight: 1.5, maxHeight: "45vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.6)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <strong style={{ color: "#ff9b9b" }}>SEQUENCE 运行时诊断（{entries.length}）</strong>
      <button type="button" onClick={() => setHidden(true)} style={{ background: "transparent", color: "#ffd9d9", border: "1px solid #ff6b6b", borderRadius: 6, padding: "1px 8px", cursor: "pointer" }}>收起</button>
    </div>
    {entries.map((entry, index) => <div key={index} style={{ borderTop: "1px solid rgba(255,107,107,.35)", paddingTop: 5, marginTop: 5, whiteSpace: "pre-wrap" }}>
      <span style={{ color: "#ffb3b3" }}>[{entry.at}] {entry.kind}</span>
      <div>{entry.message}</div>
    </div>)}
  </div>;
}
