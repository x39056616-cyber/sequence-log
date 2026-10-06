"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Plus, Sparkles, Trash2 } from "lucide-react";
import { ABILITY_COVERAGE } from "@/lib/lore/abilities";
import { createManualSkill, deleteManualSkill, listSkills, settleSkillDecay, trainSkillManually, unlockCurrentSequenceSkill } from "@/lib/repository";
import { levelThreshold, SKILL_MAX_PROFICIENCY } from "@/lib/domain/skill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";

/** 作者补充设定是 Markdown 列表，逐行清理后按段落展示。 */
function authorLines(text: string): string[] {
  return text.split(/\n+/).map((line) => line.replace(/\*\*/g, "").replace(/^[-•]\s*/, "").trim()).filter((line) => line.length > 0);
}

const STATUS_LABEL: Record<string, string> = {
  author: "已核验能力",
  canon: "小说原文",
  undisclosed: "原作未披露·待补充",
  manual: "自建技能",
};

export function SkillPanel() {
  const skills = useLiveQuery(() => listSkills(), [], []);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      await unlockCurrentSequenceSkill();
      await settleSkillDecay();
    })();
  }, []);

  async function addSkill() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createManualSkill({ name, description: "" });
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="serif text-xl">技能</h2>
            <p className="mt-1 text-xs text-muted">技能名使用已核验的序列名；能力详情来自已核验资料。完成任务会训练当前序列技能。未披露的能力等你补充。</p>
          </div>
          <Badge>{ABILITY_COVERAGE.withAbilityEvidence} / {ABILITY_COVERAGE.sequences} 个序列有可核验能力</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {skills.map((skill) => {
          const floor = levelThreshold(skill.level);
          const span = Math.max(1, SKILL_MAX_PROFICIENCY - floor);
          const value = Math.max(0, Math.min(100, ((skill.proficiency - floor) / span) * 100));
          return (
            <div key={skill.id} className="rounded-md border border-border bg-panel-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="serif text-lg">{skill.name}</span>
                  {skill.sequence !== null && <Badge>序列 {skill.sequence}</Badge>}
                  <Badge>{skill.level}</Badge>
                </div>
                <span className="text-[11px] text-muted">{STATUS_LABEL[skill.status] ?? skill.status}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={value} />
                <span className="w-24 shrink-0 text-right text-[11px] text-muted">{skill.proficiency} / {SKILL_MAX_PROFICIENCY}</span>
              </div>
              {skill.authorText && (
                <div className="mt-2 space-y-1 rounded-md border border-brass/30 bg-brass/5 p-3 text-[11px] leading-5">
                  
                  {authorLines(skill.authorText).map((line, index) => <p key={index}>{line}</p>)}
                </div>
              )}
              {skill.evidenceText && (
                <details className="mt-2 text-[11px] text-muted">
                  <summary className="cursor-pointer">小说原文摘录{skill.citations[0]?.chapter ? " · " + skill.citations[0].chapter : ""}</summary>
                  <p className="mt-1 leading-5">“{skill.evidenceText}”</p>
                </details>
              )}
              {!skill.authorText && !skill.evidenceText && (
                <p className="mt-2 text-[11px] text-warning">原作与作者补充设定都没有披露该序列的能力；你补充内容时会替换此处。</p>
              )}
              {skill.manual && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void trainSkillManually(skill.id, 5)}><Sparkles className="size-3" />手动练习 +5</Button>
                  <Button size="sm" variant="ghost" onClick={() => void deleteManualSkill(skill.id)}><Trash2 className="size-3" />删除</Button>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="min-w-40 flex-1">
            <p className="mb-1 flex items-center gap-1 text-[11px] text-muted"><BookOpen className="size-3" />新增自建技能（如「占卜」「黑魔法」）</p>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="技能名" />
          </div>
          <Button onClick={addSkill} disabled={busy || !name.trim()}><Plus className="size-4" />添加</Button>
        </div>
      </CardContent>
    </Card>
  );
}



