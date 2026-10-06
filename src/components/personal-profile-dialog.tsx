"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Goal, GoalHorizon, LifeConstraint, PersonalProfile } from "@/lib/types";
import { db } from "@/lib/db";
import { uid } from "@/lib/utils";
import { savePersonalProfile } from "@/lib/repository";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/form";

export function PersonalProfileDialog(props: { open: boolean; onClose: () => void; required?: boolean }) {
  const stored = useLiveQuery(() => db.personalProfile.get("me"), []);
  if (!stored) return null;
  return <ProfileForm key={stored.updatedAt} profile={stored} {...props} />;
}

function ProfileForm({ profile, open, onClose, required = false }: { profile: PersonalProfile; open: boolean; onClose: () => void; required?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState(profile.summary);
  const [goalsText, setGoalsText] = useState(profile.goals.map((goal) => goal.title).join("\n"));
  const [interests, setInterests] = useState(profile.interests.join(", "));
  const [domains, setDomains] = useState(profile.preferredDomains.join(", "));
  const [avoided, setAvoided] = useState(profile.avoidedTasks.join(", "));
  const [weekday, setWeekday] = useState(profile.weekdayMinutes);
  const [weekend, setWeekend] = useState(profile.weekendMinutes);
  const [preferredTime, setPreferredTime] = useState(profile.preferredTime);
  const [energy, setEnergy] = useState(profile.energyPattern);
  const [environment, setEnvironment] = useState(profile.environment.join(", "));
  const [equipment, setEquipment] = useState(profile.equipment.join(", "));
  const [difficulty, setDifficulty] = useState(profile.difficultyPreference);
  const byCategory = Object.fromEntries(profile.constraints.map((item) => [item.category, item]));
  const [health, setHealth] = useState(byCategory.health?.summary ?? "");
  const [budget, setBudget] = useState(byCategory.budget?.summary ?? "");
  const [socialConstraint, setSocialConstraint] = useState(byCategory.social?.summary ?? "");
  const [healthSharing, setHealthSharing] = useState<LifeConstraint["sharing"]>(byCategory.health?.sharing ?? "summary");
  const [budgetSharing, setBudgetSharing] = useState<LifeConstraint["sharing"]>(byCategory.budget?.sharing ?? "summary");
  const [socialSharing, setSocialSharing] = useState<LifeConstraint["sharing"]>(byCategory.social?.sharing ?? "summary");
  const list = (value: string) => value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  async function submit() {
    setSaving(true);
    try {
      const goals: Goal[] = goalsText.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12).map((title) => ({ id: uid(), title, description: "", horizon: "90d" as GoalHorizon, priority: 3, active: true }));
      const constraints: LifeConstraint[] = [
        ["health", health, healthSharing], ["budget", budget, budgetSharing], ["social", socialConstraint, socialSharing],
      ].flatMap(([category, value, sharing]) => value ? [{ id: uid(), category: category as LifeConstraint["category"], summary: String(value).slice(0, 180), detail: String(value).slice(0, 600), sharing: sharing as LifeConstraint["sharing"] }] : []);
      await savePersonalProfile({ ...profile, summary, goals, interests: list(interests), preferredDomains: list(domains), avoidedTasks: list(avoided), constraints, weekdayMinutes: weekday, weekendMinutes: weekend, preferredTime, energyPattern: energy, environment: list(environment), equipment: list(equipment), socialPreference: profile.socialPreference, difficultyPreference: difficulty, consentVersion: Math.max(1, profile.consentVersion + 1) });
      onClose();
    } finally { setSaving(false); }
  }
  return <Dialog open={open} onClose={required ? () => {} : onClose} title="建立非凡者生活画像" className="max-w-4xl">
    <div className="max-h-[78vh] space-y-5 overflow-y-auto pr-1">
      <p className="text-sm leading-6 text-muted">这些信息用于本机规划安全任务。敏感项默认只以区间摘要发送给 AI，可逐类关闭；不会收集住址、账号、联系人、收入明细或诊断记录。</p>
      <div className="grid gap-4 md:grid-cols-2"><div><Label>当前生活摘要</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="例如：正在学习编程，希望改善作息和体能。"/></div><div><Label>长期目标（每行一项）</Label><Textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} placeholder={"完成一个作品集\n稳定每周运动三次"}/></div></div>
      <div className="grid gap-4 md:grid-cols-3"><div><Label>兴趣</Label><Input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="阅读, 游戏, 写作"/></div><div><Label>偏好领域</Label><Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="intellect, focus, body"/></div><div><Label>不想收到的任务</Label><Input value={avoided} onChange={(e) => setAvoided(e.target.value)} placeholder="深夜运动, 电话沟通"/></div></div>
      <div className="grid gap-4 md:grid-cols-3"><div><Label>工作日可用分钟</Label><Input type="number" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}/></div><div><Label>周末可用分钟</Label><Input type="number" value={weekend} onChange={(e) => setWeekend(Number(e.target.value))}/></div><div><Label>难度偏好</Label><Select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as PersonalProfile["difficultyPreference"])}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</Select></div></div>
      <div className="grid gap-4 md:grid-cols-4"><div><Label>偏好时间</Label><Select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value as PersonalProfile["preferredTime"])}><option value="flexible">灵活</option><option value="morning">早晨</option><option value="afternoon">下午</option><option value="evening">晚上</option></Select></div><div><Label>精力节律</Label><Select value={energy} onChange={(e) => setEnergy(e.target.value as PersonalProfile["energyPattern"])}><option value="variable">不稳定</option><option value="morning-peak">早晨峰值</option><option value="afternoon-peak">下午峰值</option><option value="evening-peak">夜间峰值</option></Select></div><div><Label>环境</Label><Input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="home, office, outdoor"/></div><div><Label>器材</Label><Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="书籍, 哑铃"/></div></div>
      <div className="grid gap-4 md:grid-cols-3"><PrivacyField label="健康/身体限制摘要" value={health} onValue={setHealth} sharing={healthSharing} onSharing={setHealthSharing}/><PrivacyField label="预算约束摘要" value={budget} onValue={setBudget} sharing={budgetSharing} onSharing={setBudgetSharing}/><PrivacyField label="社交偏好摘要" value={socialConstraint} onValue={setSocialConstraint} sharing={socialSharing} onSharing={setSocialSharing}/></div>
      <div className="flex justify-end gap-2">{!required && <Button variant="secondary" onClick={onClose}>取消</Button>}<Button onClick={submit} disabled={saving}>{saving ? "正在建立画像" : "授权并保存"}</Button></div>
    </div>
  </Dialog>;
}

function PrivacyField({ label, value, onValue, sharing, onSharing }: { label: string; value: string; onValue: (value: string) => void; sharing: LifeConstraint["sharing"]; onSharing: (value: LifeConstraint["sharing"]) => void }) {
  return <div><Label>{label}</Label><Input value={value} onChange={(e) => onValue(e.target.value)}/><Select value={sharing} onChange={(e) => onSharing(e.target.value as LifeConstraint["sharing"])}><option value="local">仅本机</option><option value="summary">只发送摘要</option><option value="full">发送详细内容</option></Select></div>;
}


