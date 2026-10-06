"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FlaskConical } from "lucide-react";
import { PATHWAYS } from "@/lib/lore/pathways";
import { AUTHOR_CONTENT, pathwaysWithFormulas } from "@/lib/lore/author-content";
import { ensureAuthorFormulas, listFormulas } from "@/lib/repository";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";

/** 魔药配方来自作者（乌贼）发布的补充设定；未发布的途径明确标注。 */
export function FormulaPanel() {
  // 默认选中作者确实发布过配方的途径，避免一进来就看到「暂未发布」。
  const withFormulas = pathwaysWithFormulas();
  const [pathwayId, setPathwayId] = useState(withFormulas[0] ?? PATHWAYS[0].id);
  const [ready, setReady] = useState(false);
  const formulas = useLiveQuery(() => listFormulas(pathwayId), [pathwayId], []);

  useEffect(() => {
    void ensureAuthorFormulas().finally(() => setReady(true));
  }, []);

  const pathway = PATHWAYS.find((item) => item.id === pathwayId) ?? PATHWAYS[0];
  const published = AUTHOR_CONTENT.formulas.some((formula) => formula.pathwayId === pathwayId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="serif flex items-center gap-2 text-xl"><FlaskConical className="size-4 text-brass" />魔药配方</h2>
            <p className="mt-1 text-xs text-muted">本页配方取自原作与作者发布的途径资料；未收录的序列会明确标注。</p>
          </div>
          <Badge>{AUTHOR_CONTENT.coverage.formulas} 条配方 · {AUTHOR_CONTENT.coverage.pathways} 条途径有补充设定</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <Select value={pathwayId} onChange={(event) => setPathwayId(event.target.value)}>
            {PATHWAYS.map((item) => <option key={item.id} value={item.id}>{item.name}途径{withFormulas.includes(item.id) ? "（有配方）" : ""}</option>)}
          </Select>
        </div>

        {!ready && <p className="text-xs text-muted">正在整理配方……</p>}
        {ready && !published && <p className="text-xs text-warning">「{pathway.name}途径」暂未收录魔药配方。</p>}

        {formulas.map((formula) => (
          <div key={formula.id} className="rounded-md border border-border bg-panel-soft p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="serif text-lg">序列 {formula.sequence} · {formula.sequenceName}</span>
              
            </div>
            <dl className="mt-2 space-y-1 text-[11px] leading-5">
              {formula.main && <div><dt className="inline text-muted">主材料：</dt><dd className="inline">{formula.main}</dd></div>}
              {formula.auxiliary && <div><dt className="inline text-muted">辅助材料：</dt><dd className="inline">{formula.auxiliary}</dd></div>}
              {formula.potionLook && <div><dt className="inline text-muted">魔药外观：</dt><dd className="inline">{formula.potionLook}</dd></div>}
              {formula.traitLook && <div><dt className="inline text-muted">非凡特性外观：</dt><dd className="inline">{formula.traitLook}</dd></div>}
              {formula.mythicForm && <div><dt className="inline text-muted">神话生物形态：</dt><dd className="inline">{formula.mythicForm}</dd></div>}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


