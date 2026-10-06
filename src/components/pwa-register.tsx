"use client";

import { useEffect } from "react";

/** 注册 Service Worker，让手机可以「添加到主屏幕」并离线打开。 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") return;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
