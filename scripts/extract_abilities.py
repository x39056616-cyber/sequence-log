#!/usr/bin/env python3
"""Build the per-sequence skill index from author supplements + the local novel.

Priority:
1. Author supplement ability (status = "author", authorText filled);
2. Curated/novel evidence (status = "canon", evidence filled);
3. No verifiable source (status = "undisclosed", kept for audit only).

The skill NAME is always the verified sequence name. Nothing is invented.

Usage:
    python scripts/extract_abilities.py \
      --source "<novel>.md" \
      --evidence src/lib/lore/evidence.generated.json \
      --pathways src/lib/lore/pathways.ts \
      --author-content src/lib/lore/author-content.generated.json \
      --output src/lib/lore/abilities.generated.json \
      --audit-output src/lib/lore/lore-audit.generated.json
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

RANKS = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
MAX_EVIDENCE = 2
EXCERPT_LIMIT = 180


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_sequences(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    out: list[dict[str, Any]] = []
    for match in re.finditer(r'\{\s*id: "([^"]+)",\s*name: "([^"]+)"[\s\S]*?names: \[([^\]]+)\]', text):
        pathway_id, pathway_name, blob = match.group(1), match.group(2), match.group(3)
        names = re.findall(r'"([^"]+)"', blob)
        if len(names) != 10:
            continue
        for rank, name in zip(RANKS, names):
            out.append({
                "pathwayId": pathway_id,
                "pathwayName": pathway_name,
                "sequence": rank,
                "sequenceName": name,
            })
    return out


def load_author_content(path: Path | None, supplement_path: Path | None = None) -> dict[str, Any]:
    if path is None or not path.exists():
        return {"meta": None, "abilities": {}, "formulas": {}}
    payload = json.loads(path.read_text(encoding="utf-8"))
    abilities: dict[str, dict[str, Any]] = {}
    for item in payload.get("abilities", []):
        key = f"{item.get('pathwayId')}-{item.get('sequence')}"
        text = str(item.get("text", "")).strip()
        if key and text:
            abilities[key] = {
                "text": text,
                "sequenceName": str(item.get("sequenceName", "")).strip(),
                "fileName": str(item.get("fileName", "")).strip(),
            }
    formulas: dict[str, dict[str, Any]] = {}
    for item in payload.get("formulas", []):
        key = f"{item.get('pathwayId')}-{item.get('sequence')}"
        if key:
            formulas[key] = item
    # 手工补录（如用户提供的审判者配方）优先于自动解析结果。
    if supplement_path is not None and supplement_path.exists():
        supplement = json.loads(supplement_path.read_text(encoding="utf-8"))
        for item in supplement.get("formulas", []):
            key = f"{item.get('pathwayId')}-{item.get('sequence')}"
            if key:
                formulas[key] = item
    return {
        "meta": payload.get("source"),
        "abilities": abilities,
        "formulas": formulas,
    }


def excerpt(line: str, term: str, limit: int = EXCERPT_LIMIT) -> str:
    index = line.find(term)
    if index < 0:
        return line[:limit].strip()
    start = max(0, index - limit // 2)
    end = min(len(line), index + len(term) + limit // 2)
    value = line[start:end].strip()
    return value if len(value) <= limit else value[:limit]


def build_formula_audit(sequences: list[dict[str, Any]], formulas: dict[str, dict[str, Any]]) -> dict[str, Any]:
    per_pathway: dict[str, list[int]] = {}
    for sequence in sequences:
        per_pathway.setdefault(sequence["pathwayId"], []).append(sequence["sequence"])
    missing: dict[str, list[int]] = {}
    for pathway_id, ranks in per_pathway.items():
        absent = [rank for rank in sorted(ranks, reverse=True) if f"{pathway_id}-{rank}" not in formulas]
        if absent:
            missing[pathway_id] = absent
    return {
        "total": len(formulas),
        "pathwaysWithFormulas": sorted({item.get("pathwayId") for item in formulas.values()}),
        "missingByPathway": missing,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--pathways", required=True)
    parser.add_argument("--author-content", required=False)
    parser.add_argument("--output", required=True)
    parser.add_argument("--formula-supplement", required=False)
    parser.add_argument("--audit-output", required=False)
    args = parser.parse_args()

    source_path = Path(args.source)
    lines = source_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    evidence = json.loads(Path(args.evidence).read_text(encoding="utf-8"))
    evidence_by_key = evidence.get("sequences", {})
    sequences = load_sequences(Path(args.pathways))
    author = load_author_content(
        Path(args.author_content) if args.author_content else None,
        Path(args.formula_supplement) if args.formula_supplement else None,
    )

    all_sequence_names = {s["sequenceName"] for s in sequences}
    entries: list[dict[str, Any]] = []
    audit_entries: list[dict[str, Any]] = []

    for seq in sequences:
        key = f"{seq['pathwayId']}-{seq['sequence']}"
        quotes: list[dict[str, Any]] = []
        seen: set[str] = set()

        # 1) Curated evidence index entries classified as "ability". The index uses
        #    substring windows, so each quote is re-checked here.
        for item in (evidence_by_key.get(key, {}) or {}).get("evidence", []):
            if item.get("kind") != "ability":
                continue
            quote = item.get("quote", "")
            if "能力" not in quote or seq["sequenceName"] not in quote:
                continue
            if quote in seen:
                continue
            seen.add(quote)
            quotes.append({"chapter": item.get("chapter", ""), "line": item.get("line", 0), "quote": quote})

        author_entry = author["abilities"].get(key)

        # 2) Targeted full-text scan only when the author did not provide the ability.
        #    This keeps author content authoritative and avoids false positives.
        if not author_entry and len(quotes) < MAX_EVIDENCE:
            name = seq["sequenceName"]
            quoted = re.compile(r"[“'‘\"]\s*" + re.escape(name) + r"\s*[”'’\"]")
            ability_word = re.compile(r"(非凡能力|能力(?:有|是|包括|为|之一|本质|效果|表现)|擅长|可以做到)")
            for index, line in enumerate(lines):
                if name not in line or not quoted.search(line):
                    continue
                if not ability_word.search(line):
                    continue
                others = [s for s in all_sequence_names if s != name and s in line]
                if others:
                    continue
                quote = excerpt(line, name)
                if len(quote) < 12 or quote in seen or name not in quote or "能力" not in quote:
                    continue
                seen.add(quote)
                quotes.append({"chapter": "", "line": index + 1, "quote": quote})
                if len(quotes) >= MAX_EVIDENCE:
                    break

        if author_entry:
            status = "author"
            source_kind = "author"
            author_text = author_entry["text"]
            reason = "作者补充设定已覆盖"
        elif quotes:
            status = "canon"
            source_kind = "novel"
            author_text = ""
            reason = "小说原文可核验"
        else:
            status = "undisclosed"
            source_kind = "undisclosed"
            author_text = ""
            reason = "作者资料与小说原文均未找到可核验能力描述"

        entry = {
            "pathwayId": seq["pathwayId"],
            "pathwayName": seq["pathwayName"],
            "sequence": seq["sequence"],
            "sequenceName": seq["sequenceName"],
            "skillName": seq["sequenceName"],
            "status": status,
            "sourceKind": source_kind,
            "authorText": author_text,
            "evidence": quotes[:MAX_EVIDENCE],
        }
        entries.append(entry)
        audit_entries.append({
            "pathwayId": seq["pathwayId"],
            "pathwayName": seq["pathwayName"],
            "sequence": seq["sequence"],
            "sequenceName": seq["sequenceName"],
            "status": status,
            "sourceKind": source_kind,
            "authorTextLength": len(author_text),
            "evidenceCount": len(entry["evidence"]),
            "reason": reason,
        })

    with_author = sum(1 for entry in entries if entry["status"] == "author")
    with_novel = sum(1 for entry in entries if entry["evidence"])
    with_evidence = sum(1 for entry in entries if entry["status"] in {"author", "canon"})
    undisclosed = sum(1 for entry in entries if entry["status"] == "undisclosed")
    coverage = {
        "sequences": len(entries),
        "withAbilityEvidence": with_evidence,
        "withAuthorAbility": with_author,
        "withNovelEvidence": with_novel,
        "undisclosed": undisclosed,
    }
    payload = {
        "schemaVersion": 2,
        "generatedAt": utc_now(),
        "source": {
            "novel": source_path.name,
            "author": author["meta"],
        },
        "note": "技能名一律使用已核验的序列名；author 优先，其次小说原文；undisclosed 仅保留待补审计。",
        "coverage": coverage,
        "abilities": entries,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.audit_output:
        formula_audit = build_formula_audit(sequences, author["formulas"])
        audit_payload = {
            "schemaVersion": 1,
            "generatedAt": utc_now(),
            "summary": {
                **coverage,
                "formulaTotal": formula_audit["total"],
                "formulaPathways": len(formula_audit["pathwaysWithFormulas"]),
            },
            "abilities": audit_entries,
            "formulas": formula_audit,
        }
        audit_path = Path(args.audit_output)
        audit_path.parent.mkdir(parents=True, exist_ok=True)
        audit_path.write_text(json.dumps(audit_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(coverage, ensure_ascii=False))


if __name__ == "__main__":
    main()