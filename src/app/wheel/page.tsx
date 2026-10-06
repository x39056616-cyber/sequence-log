"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { Check, ChevronRight, Dices, History, Info, Layers, LoaderCircle, Plus, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { db, ensureWheelSeed, restoreWheelPresets } from "@/lib/db";
import {
  clearFateProfile,
  createWheelCategory,
  createWheelOption,
  deleteWheelCategory,
  deleteWheelOption,
  listFateProfiles,
  listWheelSpins,
  recordWheelSpin,
  saveCharacterBackground,
  getActiveCharacterBackground,
  saveFateProfile,
  spinAllCategories,
  updateWheelOption,
} from "@/lib/repository";
import { generateBackgroundDraft } from "@/lib/adventure/service";
import { attributeFromOption, describeUnlock, fateSummary, orderCategoriesForSpin, resolvePool, unlockedPoolsFromAttributes } from "@/lib/wheel/engine";
import type { BackgroundFields, CharacterBackground, FateAttribute, FateProfile, WheelCategory, WheelOption, WheelSpin } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { FateWheel, type WheelSlice } from "@/components/fate-wheel";

interface LastResult {
  category: WheelCategory;
  option: WheelOption;
  spin: WheelSpin;
}

const SOURCE_LABEL: Record<string, string> = {
  "video-preset": "转盘二创预设",
  "canon-tarot": "原作塔罗代号",
  "canon-figure": "原作人物",
  "canon-item": "原作物品",
  "canon-reference": "原作引用",
  authored: "自制（非原作设定）",
};

const POOL_LABEL: Record<string, string> = { transmigrator: "穿书者池", oldOne: "非人池", special: "特殊眷属池" };

export default function WheelPage() {
  const categoriesRaw = useLiveQuery(() => db.wheelCategories.toArray(), [], [] as WheelCategory[]);
  const options = useLiveQuery(() => db.wheelOptions.toArray(), [], [] as WheelOption[]);
  const settings = useLiveQuery(() => db.settings.get("app"), [], undefined);
  const [spins, setSpins] = useState<WheelSpin[]>([]);
  const [profiles, setProfiles] = useState<FateProfile[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [draft, setDraft] = useState<FateAttribute[]>([]);
  const [last, setLast] = useState<LastResult | null>(null);
  const [slices, setSlices] = useState<WheelSlice[]>([]);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [spinKey, setSpinKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [fateName, setFateName] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [backgroundDraft, setBackgroundDraft] = useState<{ fields: BackgroundFields; backgroundText: string; provider: string; model: string } | null>(null);
  const [savedBackground, setSavedBackground] = useState<CharacterBackground | null>(null);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");

  const refreshLog = useCallback(async () => {
    const [nextSpins, nextProfiles, nextBackground] = await Promise.all([listWheelSpins(), listFateProfiles(), getActiveCharacterBackground()]);
    setSpins(nextSpins);
    setProfiles(nextProfiles);
    setSavedBackground(nextBackground);
  }, []);

  useEffect(() => { void ensureWheelSeed().then(refreshLog); }, [refreshLog]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Reading the media query once on mount is the standard pattern; it is not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(query.matches);
    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  const categories = useMemo(() => orderCategoriesForSpin(categoriesRaw), [categoriesRaw]);
  // Derived rather than stored, so the default selection never triggers a cascading effect.
  const activeCategoryId = selectedCategoryId || categories[0]?.id || "";

  const activeProfile = profiles.find((profile) => profile.status === "active") ?? null;
  const selectedCategory = categories.find((category) => category.id === activeCategoryId) ?? null;
  const unlockedPools = useMemo(() => unlockedPoolsFromAttributes(draft), [draft]);
  const allowNonCanonGeo = settings?.allowNonCanonGeo !== false;
  const currentPool = useMemo(
    () => (selectedCategory ? resolvePool(options, selectedCategory.id, unlockedPools, { allowNonCanon: allowNonCanonGeo }) : []),
    [options, selectedCategory, unlockedPools, allowNonCanonGeo],
  );

  const displaySlices: WheelSlice[] = slices.length > 0 ? slices : currentPool.map((option) => ({ id: option.id, label: option.label, pool: option.pool }));
  const respinCount = selectedCategory ? spins.filter((spin) => spin.categoryId === selectedCategory.id).length : 0;
  // 渲染层需要知道当前抽到的年代（用于空类别的提示）
  const currentEraLabel = draft.find((item) => item.categoryId === "era")?.optionLabel ?? null;

  async function spinOne() {
    if (!selectedCategory) return;
    setBusy(true);
    setMessage("");
    try {
      // 层级：年代约束大地点，大地点约束小地点，阵营约束代号。
      const eraLabel = draft.find((item) => item.categoryId === "era")?.optionLabel ?? null;
      const parentLabel = selectedCategory.id === "region"
        ? draft.find((item) => item.categoryId === "continent")?.optionLabel ?? null   // 国家跟随大陆
        : selectedCategory.id === "locality"
          ? draft.find((item) => item.categoryId === "region")?.optionLabel ?? null   // 城市跟随国家
          : selectedCategory.id === "codename"
            ? draft.find((item) => item.categoryId === "faction")?.optionLabel ?? null
            : null;
      const pool = resolvePool(options, selectedCategory.id, unlockedPools, { era: eraLabel, parent: parentLabel, allowNonCanon: allowNonCanonGeo });
      if (pool.length === 0) {
        setMessage(`${eraLabel ?? ""}${parentLabel ? "·" + parentLabel : ""} 在该纪元没有可核验的「${selectedCategory.label}」资料，已跳过。`);
        setBusy(false); return;
      }
      const result = await recordWheelSpin({ categoryId: selectedCategory.id, unlockedPools, era: eraLabel, parent: parentLabel, allowNonCanon: allowNonCanonGeo });
      setDraft((previous) => [...previous.filter((item) => item.categoryId !== selectedCategory.id), attributeFromOption(result.category, result.option)]);
      setSlices(pool.map((option) => ({ id: option.id, label: option.label, pool: option.pool })));
      setTargetIndex(pool.findIndex((option) => option.id === result.option.id));
      setSpinKey(result.spin.id);
      setLast(result);
      await refreshLog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "旋转失败");
    } finally {
      setBusy(false);
    }
  }

  async function spinAll() {
    setBusy(true);
    setMessage("");
    try {
      const results = await spinAllCategories();
      setDraft(results.map(({ category, option }) => attributeFromOption(category, option)));
      const first = results[0];
      if (first) {
        const pool = resolvePool(options, first.category.id, []);
        setSlices(pool.map((option) => ({ id: option.id, label: option.label, pool: option.pool })));
        setTargetIndex(pool.findIndex((option) => option.id === first.option.id));
        setSpinKey(first.spin.id);
        setLast(first);
      }
      setMessage("已按「身份类型优先」的顺序抽完整套命运。");
      await refreshLog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "抽取失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveFate() {
    if (draft.length === 0) { setMessage("先抽至少一个类别。"); return; }
    setBusy(true);
    try {
      await saveFateProfile({ selections: draft, note, name: fateName });
      setNote(""); setFateName("");
      setMessage("已存入命运档案（旧档案保留为历史）。");
      await refreshLog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function resetFate() {
    if (!window.confirm("清除当前生效的命运档案？历史仍会保留。")) return;
    await clearFateProfile();
    setDraft([]);
    setLast(null);
    setSlices([]);
    setTargetIndex(null);
    setSpinKey(null);
    await refreshLog();
  }

  async function makeBackground() {
    setBackgroundBusy(true);
    setBackgroundError("");
    try {
      const draft = await generateBackgroundDraft();
      setBackgroundDraft(draft);
    } catch (error) {
      setBackgroundError(error instanceof Error ? error.message : "人物背景生成失败");
    } finally {
      setBackgroundBusy(false);
    }
  }

  async function persistBackground() {
    if (!backgroundDraft) return;
    setBackgroundBusy(true);
    try {
      const saved = await saveCharacterBackground({
        fields: backgroundDraft.fields,
        backgroundText: backgroundDraft.backgroundText,
        fateProfileId: activeProfile?.id ?? null,
        provider: backgroundDraft.provider,
        model: backgroundDraft.model,
      });
      setSavedBackground(saved);
      setBackgroundDraft(null);
      setMessage("人物档案已保存。下一步：回到「冒险」页点「开始第一章」。");
      await refreshLog();
    } catch (error) {
      setBackgroundError(error instanceof Error ? error.message : "保存人物档案失败");
    } finally {
      setBackgroundBusy(false);
    }
  }
  async function addCategory(form: FormData) {
    await createWheelCategory({
      label: String(form.get("label") ?? ""),
      description: String(form.get("description") ?? ""),
      order: Number(form.get("order") ?? 90),
      taskAffinityAllowed: form.get("taskAffinityAllowed") === "on",
    });
    setMessage("已新建类别。");
  }

  async function addOption(form: FormData) {
    await createWheelOption({
      categoryId: String(form.get("categoryId") ?? ""),
      label: String(form.get("label") ?? ""),
      description: String(form.get("description") ?? ""),
      order: Number(form.get("order") ?? 50),
      enabled: true,
      pool: "default",
      taskAffinity: form.get("taskAffinity") === "on",
    });
    setMessage("已新增扇区。");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs tracking-[.28em] text-brass">FATE WHEEL · 命运转盘</p>
          <h1 className="serif mt-2 text-3xl sm:text-4xl">让灰雾替你掷一次骰子</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            人物永远是现实中的你，途径由你自己选择；转盘只抽身份类型、事件变故、阵营、代号与地点。抽出的结果存为命运档案，由你在冒险页手动开局。
          </p>
        </div>
        <Button onClick={spinAll} disabled={busy || categories.length === 0}><Dices className="size-4" />一键抽整套命运</Button>
      </header>

      {message && <div className="rounded-md border border-brass/30 bg-brass/10 p-3 text-sm gold-text">{message}</div>}

<Card>
  <CardHeader>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs tracking-[.2em] text-brass">STEP 2 / 3 · 人物背景</p>
        <h2 className="serif mt-1 text-xl">用命运生成人物档案</h2>
        <p className="mt-1 text-xs text-muted">AI 会依据命运档案写出姓名、职业、出身、动机、秘密等档案与一段成文背景；生成后可修改再保存。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={makeBackground} disabled={backgroundBusy || !activeProfile}>{backgroundBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{savedBackground || backgroundDraft ? "重新生成" : "生成人物背景"}</Button>
        {savedBackground && <Link href="/"><Button variant="secondary"><ChevronRight className="size-4" />STEP 3 · 去开始第一章</Button></Link>}
      </div>
    </div>
  </CardHeader>
  <CardContent className="space-y-3">
    {backgroundError && <div className="rounded-md border border-danger/50 bg-danger/10 p-3 text-xs text-danger">{backgroundError}<span className="ml-2 text-muted">可再次点击生成重试。</span></div>}
    {!activeProfile && <p className="text-xs text-muted">先完成第 1 步：抽取并保存命运档案。</p>}
    {activeProfile && !backgroundDraft && !savedBackground && <p className="text-xs text-muted">还没有人物档案。点右上角「生成人物背景」。</p>}
    {backgroundDraft && (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {([["name","姓名"],["age","年龄"],["occupation","职业"],["origin","出身"],["appearance","外貌"],["personality","性格"],["motive","动机"],["secret","秘密"],["keepsake","随身物"],["weakness","弱点"]] as const).map(([key,label])=><div key={key}><Label>{label}</Label><Input value={backgroundDraft.fields[key]} onChange={(event)=>setBackgroundDraft({...backgroundDraft,fields:{...backgroundDraft.fields,[key]:event.target.value}})}/></div>)}
        </div>
        <div>
          <Label>背景正文（400–800 字）</Label>
          <Textarea value={backgroundDraft.backgroundText} onChange={(event)=>setBackgroundDraft({...backgroundDraft,backgroundText:event.target.value})} className="min-h-56" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={persistBackground} disabled={backgroundBusy}>{backgroundBusy?<LoaderCircle className="size-4 animate-spin"/>:<Save className="size-4"/>}保存人物档案</Button>
          <span className="text-[11px] text-muted">{backgroundDraft.provider} · {backgroundDraft.model} · 正文 {backgroundDraft.backgroundText.length} 字</span>
        </div>
      </div>
    )}
    {!backgroundDraft && savedBackground && (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          <Badge>{savedBackground.fields.name}</Badge>
          <Badge>{savedBackground.fields.occupation}</Badge>
          <Badge>{savedBackground.fields.origin}</Badge>
        </div>
        <div className="rounded-md border border-brass/30 bg-brass/5 p-4"><p className="whitespace-pre-wrap font-serif text-sm leading-7">{savedBackground.backgroundText}</p></div>
        <p className="text-[11px] text-muted">已保存，可在「档案」页查看与编辑。下一步回「冒险」页点「开始第一章」。</p>
      </div>
    )}
  </CardContent>
</Card>

      {activeProfile && (
        <div className="rounded-lg border border-brass/40 bg-brass/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-[.2em] text-brass">当前生效的命运档案</p>
              <p className="mt-1 text-sm">{activeProfile.name ? activeProfile.name + " · " : ""}{fateSummary(activeProfile)}</p>
              <p className="mt-1 text-[11px] text-muted">抽于 {new Date(activeProfile.spunAt).toLocaleString("zh-CN")}{activeProfile.note ? " · " + activeProfile.note : ""}</p>
            </div>
            <Button variant="secondary" onClick={resetFate}><RotateCcw className="size-4" />清除生效命运</Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="serif text-xl">转盘</h2>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span>等概率 · 真随机</span>
                <span>·</span>
                <span>本类别已抽 {respinCount} 次</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => { setSelectedCategoryId(category.id); setSlices([]); setTargetIndex(null); setSpinKey(null); setLast(null); }}
                  className={"rounded-full border px-3 py-1.5 text-xs transition " + (category.id === activeCategoryId ? "border-brass bg-brass/15 text-brass-bright" : "border-border text-muted hover:border-brass/50")}
                >
                  {category.label}
                  {category.gate && <span className="ml-1 text-[10px] text-brass">闸门</span>}
                </button>
              ))}
            </div>

            {selectedCategory && currentPool.length === 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-center">
                <p className="text-sm text-warning">{currentEraLabel ?? "当前纪元"}没有可核验的「{selectedCategory.label}」资料</p>
                <p className="mt-1 text-xs text-muted">原著在这个年代没有留下这方面的记载，所以不会硬塞一个不该出现的选项。</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" onClick={() => { setSelectedCategoryId("era"); setSlices([]); setTargetIndex(null); setSpinKey(null); setLast(null); }}>重新抽年代</Button>
                  {categories[(categories.findIndex((item) => item.id === selectedCategory.id) + 1) % categories.length] && (
                    <Button size="sm" variant="secondary" onClick={() => { const next = categories[(categories.findIndex((item) => item.id === selectedCategory.id) + 1) % categories.length]; setSelectedCategoryId(next.id); setSlices([]); setTargetIndex(null); setSpinKey(null); setLast(null); }}>跳到下一个类别</Button>
                  )}
                </div>
              </div>
            )}            <FateWheel slices={displaySlices} targetIndex={targetIndex} spinKey={spinKey} reducedMotion={reducedMotion} />

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={spinOne} disabled={busy || !selectedCategory || currentPool.length === 0}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Dices className="size-4" />}
                {last && last.category.id === activeCategoryId ? "重新旋转" : "点击旋转"}
              </Button>
              {selectedCategory && <span className="text-xs text-muted">池内扇区：{currentPool.length} · 原著 {currentPool.filter((option) => !option.nonCanon).length} · 非原作 {currentPool.filter((option) => option.nonCanon).length}</span>}
            </div>

            {unlockedPools.length > 0 && (
              <p className="flex items-center gap-2 text-xs text-moss"><Sparkles className="size-3" />已解锁特殊池：{unlockedPools.map((pool) => POOL_LABEL[pool]).join("、")}</p>
            )}

            <div aria-live="polite" className="min-h-16">
              {last && (
                <div className="rounded-lg border border-border bg-panel-soft p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{last.category.label}</Badge>
                    <Badge>{SOURCE_LABEL[last.option.sourceKind] ?? last.option.sourceKind}</Badge>
                    {last.option.pool !== "default" && <Badge>特殊池</Badge>}{last.option.nonCanon && <Badge>非原作地名</Badge>}
                  </div>
                  <h3 className="serif mt-2 text-2xl">{last.option.label}</h3>
                  <p className="mt-1 text-sm text-muted">{last.option.description}</p>
                  {describeUnlock(last.option) && <p className="mt-2 text-xs text-moss">{describeUnlock(last.option)}</p>}
                  <p className="mt-2 text-[11px] text-muted">
                    来源：{last.option.sourceNote}
                    {last.option.citations.length > 0 && "（" + last.option.citations[0].chapter + " 第" + last.option.citations[0].line + " 行）"}
                  </p>
                  {last.option.citations[0] && <p className="mt-1 text-[11px] italic text-muted">“{last.option.citations[0].quote}”</p>}
                </div>
              )}
            </div>

            {draft.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <p className="mb-2 text-xs text-muted">本轮草稿（{draft.length} 项）</p>
                <div className="space-y-1 text-xs">
                  {draft.map((attribute) => (
                    <div key={attribute.categoryId} className="flex items-center justify-between gap-2">
                      <span className="text-muted">{attribute.categoryLabel}</span>
                      <span>{attribute.optionLabel}{attribute.taskAffinity && <span className="ml-1 text-brass">· 可提现实任务</span>}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  <Input value={fateName} onChange={(event) => setFateName(event.target.value)} placeholder="给这份命运命名（可选）" />
                  <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="给这份命运写一句备注（可选）" />
                  <Button onClick={saveFate} disabled={busy}><Save className="size-4" />存入命运档案</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="serif flex items-center gap-2 text-xl"><History className="size-4 text-brass" />抽取历史</h2></CardHeader>
            <CardContent className="space-y-2">
              {spins.slice(0, 12).map((spin) => (
                <div key={spin.id} className="rounded-md border border-border bg-panel-soft p-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">{spin.categoryLabel}</span>
                    <span className="text-muted">{new Date(spin.createdAt).toLocaleTimeString("zh-CN")}</span>
                  </div>
                  <p className="mt-1">{spin.optionLabel}</p>
                  <p className="mt-1 text-muted">池 {spin.poolSize} 扇区 · 随机字节 {spin.rngBytes || "—"}{spin.isRespin ? " · 第 " + (spin.respinIndex + 1) + " 次" : ""}</p>
                </div>
              ))}
              {spins.length === 0 && <p className="text-xs text-muted">还没有抽过。</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="serif flex items-center gap-2 text-xl"><Layers className="size-4 text-brass" />命运档案历史</h2></CardHeader>
            <CardContent className="space-y-2">
              {profiles.slice(0, 8).map((profile) => (
                <div key={profile.id} className="rounded-md border border-border bg-panel-soft p-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className={profile.status === "active" ? "text-brass-bright" : "text-muted"}>{profile.status === "active" ? "生效中" : "已归档"}</span>
                    <span className="text-muted">{new Date(profile.spunAt).toLocaleString("zh-CN")}</span>
                  </div>
                  <p className="mt-1">{profile.name ? profile.name + " · " : ""}{fateSummary(profile)}</p>
                </div>
              ))}
              {profiles.length === 0 && <p className="text-xs text-muted">还没有保存过命运档案。</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="serif text-xl">类别与扇区管理</h2>
              <p className="mt-1 text-xs text-muted">可新建类别与扇区；内置预设可一键恢复，自建内容不会被删除。</p>
            </div>
            <Button variant="secondary" onClick={() => void restoreWheelPresets().then(refreshLog)}><RotateCcw className="size-4" />恢复内置预设</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm"><Plus className="mr-1 inline size-4" />新建类别</summary>
            <form action={addCategory} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label>类别名</Label><Input name="label" required /></div>
              <div><Label>排序</Label><Input name="order" type="number" defaultValue={90} /></div>
              <div className="sm:col-span-2"><Label>说明</Label><Input name="description" /></div>
              <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" name="taskAffinityAllowed" />允许此类别携带现实任务倾向</label>
              <Button type="submit" className="sm:col-span-2"><Check className="size-4" />创建类别</Button>
            </form>
          </details>

          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm"><Plus className="mr-1 inline size-4" />新增扇区</summary>
            <form action={addOption} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>所属类别</Label>
                <Select name="categoryId" defaultValue={activeCategoryId}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </Select>
              </div>
              <div><Label>扇区文字</Label><Input name="label" required /></div>
              <div className="sm:col-span-2"><Label>说明</Label><Input name="description" /></div>
              <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" name="taskAffinity" />该扇区可携带现实任务倾向</label>
              <Button type="submit" className="sm:col-span-2"><Check className="size-4" />添加扇区</Button>
            </form>
          </details>

          <div className="space-y-3">
            {categories.map((category) => {
              const categoryOptions = options.filter((option) => option.categoryId === category.id).sort((a, b) => a.order - b.order);
              return (
                <div key={category.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm">{category.label} <span className="ml-1 text-[10px] text-muted">{SOURCE_LABEL[category.sourceKind] ?? category.sourceKind}</span></p>
                      <p className="text-[11px] text-muted">{category.description}</p>
                    </div>
                    {!category.builtIn && (
                      <Button variant="ghost" onClick={() => void deleteWheelCategory(category.id).then(refreshLog)}><Trash2 className="size-4" />删除类别</Button>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {categoryOptions.map((option) => (
                      <div key={option.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-1 text-xs">
                        <span>{option.label}{option.pool !== "default" && <span className="ml-1 text-[10px] text-moss">特殊池</span>}{option.taskAffinity && <span className="ml-1 text-[10px] text-brass">可提任务</span>}</span>
                        <span className="flex items-center gap-2 text-[10px] text-muted">
                          {option.builtIn ? "内置" : "自建"}
                          <button type="button" className="underline" onClick={() => void updateWheelOption(option.id, { enabled: !option.enabled }).then(refreshLog)}>{option.enabled ? "停用" : "启用"}</button>
                          {!option.builtIn && <button type="button" className="underline" onClick={() => void deleteWheelOption(option.id).then(refreshLog)}>删除</button>}
                        </span>
                      </div>
                    ))}
                    {categoryOptions.length === 0 && <p className="text-[11px] text-muted">暂无扇区。</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs leading-5 text-muted">
        <Info className="mt-0.5 size-3 shrink-0" />
        转盘完全在本地运行，不调用任何 AI 或网络。结果仅影响叙事与可拒绝的现实任务提案，不会改动 XP、等级、序列或消化度。
      </p>
    </div>
  );
}












