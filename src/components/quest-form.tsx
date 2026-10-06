"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { createQuest, updateQuest, type QuestDraft } from "@/lib/repository";
import type { Quest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/form";

const schema = z.object({
  title: z.string().min(1, "请输入任务名称").max(100),
  description: z.string().max(800),
  status: z.enum(["inbox", "today", "active", "completed"]),
  type: z.enum(["main", "side", "daily", "weekly", "oneoff", "habit", "boss"]),
  difficulty: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(4),
  estimatedMinutes: z.number().int().min(1).max(1440),
  dueAt: z.string(),
  xpOverride: z.string(),
  actingFit: z.number().refine((value) => [0, 0.5, 1, 1.5].includes(value)),
  attributeIds: z.array(z.string()).min(1, "至少关联一项属性"),
  tags: z.string(),
  notes: z.string().max(1000),
});
type FormValues = z.infer<typeof schema>;

export function QuestForm({ open, onClose, quest }: { open: boolean; onClose: () => void; quest?: Quest | null }) {
  const attributes = useLiveQuery(() => db.attributes.orderBy("order").toArray(), [], []);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(quest) });
  useEffect(() => { if (open) form.reset(defaults(quest)); }, [open, quest, form]);
  async function submit(values: FormValues) {
    const draft: QuestDraft = {
      title: values.title, description: values.description, status: values.status, type: values.type,
      difficulty: values.difficulty as Quest["difficulty"], priority: values.priority as Quest["priority"],
      estimatedMinutes: values.estimatedMinutes, dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
      xpOverride: values.xpOverride === "" ? null : Math.max(0, Number(values.xpOverride)), actingFit: values.actingFit as Quest["actingFit"],
      attributeIds: values.attributeIds, tags: values.tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean), notes: values.notes,
    };
    if (quest) await updateQuest(quest.id, draft); else await createQuest(draft);
    onClose();
  }
  return <Dialog open={open} onClose={onClose} title={quest ? "编辑任务" : "派发新任务"} className="max-w-3xl">
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
      <div><Label htmlFor="quest-title">任务名称</Label><Input id="quest-title" {...form.register("title")} placeholder="例如：完成 45 分钟深度阅读" />{form.formState.errors.title && <p className="mt-1 text-xs text-danger">{form.formState.errors.title.message}</p>}</div>
      <div><Label htmlFor="quest-description">描述</Label><Textarea id="quest-description" {...form.register("description")} placeholder="写出完成标准，避免模糊任务。" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="状态"><Select {...form.register("status")}><option value="inbox">收集箱</option><option value="today">今日</option><option value="active">进行中</option></Select></Field>
        <Field label="类型"><Select {...form.register("type")}><option value="main">主线</option><option value="side">支线</option><option value="daily">日常</option><option value="weekly">每周</option><option value="oneoff">一次性</option><option value="habit">习惯</option><option value="boss">首领任务</option></Select></Field>
        <Field label="难度"><Select {...form.register("difficulty", { valueAsNumber: true })}><option value="1">1 · 轻松</option><option value="2">2 · 简单</option><option value="3">3 · 标准</option><option value="4">4 · 困难</option><option value="5">5 · 首领</option></Select></Field>
        <Field label="优先级"><Select {...form.register("priority", { valueAsNumber: true })}><option value="1">低</option><option value="2">普通</option><option value="3">高</option><option value="4">关键</option></Select></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="预计分钟"><Input type="number" {...form.register("estimatedMinutes", { valueAsNumber: true })} /></Field>
        <Field label="截止时间"><Input type="datetime-local" {...form.register("dueAt")} /></Field>
        <Field label="覆盖基础消化值"><Input type="number" placeholder="留空自动计算" {...form.register("xpOverride")} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="扮演契合度"><Select {...form.register("actingFit", { valueAsNumber: true })}><option value="0">无关 · 0</option><option value="0.5">间接 · 0.5</option><option value="1">契合 · 1.0</option><option value="1.5">高度契合 · 1.5</option></Select></Field>
        <Field label="标签"><Input {...form.register("tags")} placeholder="学习, 深度工作" /></Field>
      </div>
      <fieldset><legend className="mb-2 text-xs font-medium text-muted-strong">关联属性</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{attributes.map((attribute) => <label key={attribute.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-panel-soft px-3 py-2 text-xs"><input type="checkbox" value={attribute.id} {...form.register("attributeIds")} />{attribute.name}</label>)}</div>{form.formState.errors.attributeIds && <p className="mt-1 text-xs text-danger">{form.formState.errors.attributeIds.message}</p>}</fieldset>
      <Field label="备注"><Textarea {...form.register("notes")} /></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button data-testid="save-quest" type="submit">{quest ? "保存修改" : "加入任务中心"}</Button></div>
    </form>
  </Dialog>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label>{children}</div>; }
function defaults(quest?: Quest | null): FormValues {
  return { title: quest?.title ?? "", description: quest?.description ?? "", status: quest?.status ?? "today", type: quest?.type ?? "side", difficulty: quest?.difficulty ?? 3, priority: quest?.priority ?? 2, estimatedMinutes: quest?.estimatedMinutes ?? 30, dueAt: quest?.dueAt ? new Date(quest.dueAt).toISOString().slice(0, 16) : "", xpOverride: quest?.xpOverride?.toString() ?? "", actingFit: quest?.actingFit ?? 1, attributeIds: quest?.attributeIds ?? ["execution"], tags: quest?.tags.join(", ") ?? "", notes: quest?.notes ?? "" };
}


