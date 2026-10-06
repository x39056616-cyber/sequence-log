"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, CheckSquare2, Dices, GalleryVerticalEnd, Home, LayoutDashboard, Moon, MoreHorizontal, ScrollText, Settings, Sparkles, Sun, UserRound, X } from "lucide-react";
import { db, ensureSeed } from "@/lib/db";
import { getPathway, getSequence } from "@/lib/lore/pathways";
import { calculateDigestionCap, calculateStatusAverage, statusBand } from "@/lib/domain/digestion";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CompletionDialog } from "@/components/completion-dialog";
import { Onboarding } from "@/components/onboarding";
import { Badge } from "@/components/ui/badge";
import { SequenceEmblem } from "@/components/sequence-emblem";
import { PathwayTarot } from "@/components/pathway-tarot";
import { Button } from "@/components/ui/button";
import { updateSettingsTheme } from "@/lib/actions";
import { ErrorBoundary } from "@/components/error-boundary";
import { RuntimeDiagnostics } from "@/components/runtime-diagnostics";

const nav = [
  { href: "/", label: "冒险", icon: Home },
  { href: "/quests", label: "非凡委托", icon: CheckSquare2 },
  { href: "/character", label: "档案", icon: UserRound },
  { href: "/progress", label: "命运轨迹", icon: BarChart3 },
  { href: "/overview", label: "效率总览", icon: LayoutDashboard },
  { href: "/habits", label: "精神锚点", icon: Sparkles },
  { href: "/wheel", label: "命运转盘", icon: Dices },
  { href: "/arcana", label: "大阿卡纳", icon: GalleryVerticalEnd },
  { href: "/codex", label: "亵渎石板", icon: ScrollText },
  { href: "/settings", label: "幕后控制台", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const navOpen = useUIStore((state) => state.navOpen);
  const setNavOpen = useUIStore((state) => state.setNavOpen);
  const profile = useLiveQuery(() => db.profile.get("me"), []);
  const state = useLiveQuery(() => db.sequenceState.get("active"), []);
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const path = getPathway(state?.pathwayId);
  const sequence = getSequence(state?.pathwayId, state?.sequence ?? 9);
  const average = settings ? calculateStatusAverage(settings.status) : 60;
  const band = statusBand(average);

  useEffect(() => { ensureSeed().finally(() => setReady(true)); }, []);
  useEffect(() => { document.documentElement.className = settings?.theme === "light" ? "light h-full antialiased" : "h-full antialiased"; }, [settings?.theme]);
  useEffect(() => { setNavOpen(false); }, [pathname, setNavOpen]);

  if (!ready) return <div className="grid min-h-screen place-items-center"><div className="text-center"><SequenceEmblem symbol="loading" size={80} className="mx-auto animate-pulse text-brass" /><p className="mt-4 text-sm text-muted">正在连接灰雾之上的记录……</p></div></div>;
  if (!profile || !state || !settings) return null;
  if (!state.pathwayId || !path || !sequence) return <Onboarding />;

  const cap = calculateDigestionCap(state.sequence, settings);
  return <><ErrorBoundary><div className="relative z-10 min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
    <aside className={cn("fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-panel-solid/95 p-4 backdrop-blur-xl transition-transform lg:sticky lg:top-0 lg:block lg:h-screen lg:w-auto lg:translate-x-0", navOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3"><div className="w-9"><PathwayTarot pathway={path} variant="compact" /></div><div><p className="serif text-base gold-text">SEQUENCE</p><p className="text-[10px] tracking-[0.24em] text-muted">序列日志</p></div></Link>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(false)} aria-label="关闭导航"><X className="size-4" /></Button>
      </div>
      <div className="panel-soft mt-5 rounded-lg p-4">
        <div className="flex items-center gap-2"><Badge>序列 {state.sequence}</Badge><span className="truncate text-sm">{sequence.name}</span></div>
        <p className="mt-2 text-xs text-muted">{path.name}途径 · {profile.title}</p>
        <div className="progress-track mt-3"><div className="progress-fill" style={{ width: `${Math.min(100, state.digestion / cap * 100)}%` }} /></div>
        <p className="mt-2 text-[11px] text-muted">{state.digestion} / {cap} 消化度</p>
      </div>
      <nav className="mt-5 space-y-1" aria-label="主导航">{nav.map((item) => { const Icon=item.icon; const active=pathname===item.href; return <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm text-muted-strong transition hover:border-border hover:bg-panel-soft hover:text-foreground", active && "border-brass/30 bg-brass/10 text-brass-bright")}><Icon className="size-4" />{item.label}</Link>; })}</nav>
      <div className="absolute bottom-4 left-4 right-4"><div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"><span>稳定度 {average}</span><span className={band.className === "danger" ? "text-danger" : band.className === "warning" ? "text-warning" : "text-moss"}>{band.label}</span></div><p className="mt-3 text-center text-[10px] leading-4 text-muted">非官方个人同人工具</p></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="打开导航"><MoreHorizontal className="size-5" /></Button><div><p className="serif text-lg gold-text">{sequence.name}</p><p className="text-[11px] text-muted">序列 {state.sequence} · {path.name}途径</p></div></div>
        <div className="flex items-center gap-2"><Badge className="hidden sm:inline-flex">{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: settings.timezone }).format(new Date())}</Badge><Button variant="ghost" size="icon" onClick={() => updateSettingsTheme(settings.theme === "dark" ? "light" : "dark")} aria-label="切换主题">{settings.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button></div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8">{children}</main>
    </div>
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-panel-solid/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="移动导航">
      {nav.slice(0,4).map((item) => { const Icon=item.icon; const active=pathname===item.href; return <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 rounded-md py-1 text-[10px] text-muted", active && "text-brass-bright")}><Icon className="size-5" />{item.label}</Link>; })}
      <button type="button" onClick={() => setNavOpen(true)} className="flex flex-col items-center gap-1 py-1 text-[10px] text-muted"><MoreHorizontal className="size-5" />更多</button>
    </nav>
    <CompletionDialog />
  </div></ErrorBoundary><RuntimeDiagnostics /></>;
}












