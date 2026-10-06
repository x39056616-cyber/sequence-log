"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Backpack, Hand, Plus, Trash2, XCircle } from "lucide-react";
import { createInventoryItem, deleteInventoryItem, listInventory, setEquipped, setStoryItemStatus } from "@/lib/repository";
import type { InventoryCategory, Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";

const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  beyond: "非凡物品",
  sealed: "封印物",
  common: "普通物品",
};

const RARITY_LABEL: Record<Item["rarity"], string> = { common: "常见", rare: "稀有", unique: "唯一" };

export function InventoryPanel() {
  const inventory = useLiveQuery(() => listInventory(), [], { items: [], storyItems: [] });
  const [tab, setTab] = useState<"beyond" | "sealed" | "story">("beyond");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("beyond");

  const permanent = inventory.items.filter((item) => (item.category ?? "beyond") === tab);
  const equippedName = [...inventory.items, ...inventory.storyItems].find((item) => item.equipped)?.name ?? "无";

  async function add() {
    if (!name.trim()) return;
    await createInventoryItem({ name, description: notes, rarity: "common", category, notes, source: "手动添加" });
    setName(""); setNotes(""); setAdding(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="serif flex items-center gap-2 text-xl"><Backpack className="size-4 text-brass" />背包</h2>
            <p className="mt-1 text-xs text-muted">当前称手：{equippedName}。称手同时只能有一件；剧情物品由故事产出。</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAdding((value) => !value)}><Plus className="size-3" />新增物品</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {([["beyond", "非凡物品"], ["sealed", "封印物"], ["story", "剧情持有物"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={"rounded-full border px-3 py-1 text-xs " + (tab === key ? "border-brass bg-brass/15 text-brass-bright" : "border-border text-muted hover:border-brass/50")}>{label}</button>
          ))}
        </div>

        {adding && (
          <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
            <div><Label>名称</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div><Label>分类</Label><Select value={category} onChange={(event) => setCategory(event.target.value as InventoryCategory)}>{Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
            <div className="sm:col-span-3"><Label>备注</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            <div className="sm:col-span-3"><Button onClick={add} disabled={!name.trim()}>保存物品</Button></div>
          </div>
        )}

        {tab !== "story" && permanent.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel-soft p-3">
            <div>
              <div className="flex items-center gap-2"><span className="serif">{item.name}</span><Badge>{RARITY_LABEL[item.rarity]}</Badge>{item.equipped && <Badge>称手中</Badge>}</div>
              <p className="mt-1 text-[11px] text-muted">{item.description || item.notes || "—"}{item.source ? " · 来源：" + item.source : ""}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void setEquipped(item.id, "item")}><Hand className="size-3" />{item.equipped ? "取消称手" : "称手"}</Button>
              <Button size="sm" variant="ghost" onClick={() => void deleteInventoryItem(item.id)}><Trash2 className="size-3" /></Button>
            </div>
          </div>
        ))}

        {tab === "story" && inventory.storyItems.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel-soft p-3">
            <div>
              <div className="flex items-center gap-2"><span className="serif">{item.name}</span><Badge>{RARITY_LABEL[item.rarity]}</Badge>{item.equipped && <Badge>称手中</Badge>}{item.status !== "held" && <Badge>{item.status === "lost" ? "已丢失" : "已消耗"}</Badge>}</div>
              <p className="mt-1 text-[11px] text-muted">{item.description || "—"}</p>
            </div>
            <div className="flex gap-2">
              {item.status === "held" && <Button size="sm" variant="secondary" onClick={() => void setEquipped(item.id, "story")}><Hand className="size-3" />{item.equipped ? "取消称手" : "称手"}</Button>}
              {item.status === "held" && <Button size="sm" variant="ghost" onClick={() => void setStoryItemStatus(item.id, "lost")}><XCircle className="size-3" />标记丢失</Button>}
            </div>
          </div>
        ))}

        {tab !== "story" && permanent.length === 0 && <p className="text-xs text-muted">该分类还没有物品。</p>}
        {tab === "story" && inventory.storyItems.length === 0 && <p className="text-xs text-muted">剧情还没有产出持有物。</p>}
      </CardContent>
    </Card>
  );
}
