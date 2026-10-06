import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PathwayDefinition } from "@/lib/types";

export const RIDER_WAITE_CARDS: Record<string, { file: string; title: string }> = {
  fool: { file: "00-TheFool.png", title: "The Fool" },
  door: { file: "01-TheMagician.png", title: "The Magician" },
  paragon: { file: "02-TheHighPriestess.png", title: "The High Priestess" },
  mother: { file: "03-TheEmpress.png", title: "The Empress" },
  "black-emperor": { file: "04-TheEmperor.png", title: "The Emperor" },
  tyrant: { file: "05-TheHierophant.png", title: "The Hierophant" },
  demoness: { file: "06-TheLovers.png", title: "The Lovers" },
  "red-priest": { file: "07-TheChariot.png", title: "The Chariot" },
  "twilight-giant": { file: "08-Strength.png", title: "Strength" },
  hermit: { file: "09-TheHermit.png", title: "The Hermit" },
  "wheel-of-fortune": { file: "10-WheelOfFortune.png", title: "Wheel of Fortune" },
  visionary: { file: "11-Justice.png", title: "Justice" },
  "hanged-man": { file: "12-TheHangedMan.png", title: "The Hanged Man" },
  death: { file: "13-Death.png", title: "Death" },
  chained: { file: "14-Temperance.png", title: "Temperance" },
  abyss: { file: "15-TheDevil.png", title: "The Devil" },
  "white-tower": { file: "16-TheTower.png", title: "The Tower" },
  darkness: { file: "17-TheStar.png", title: "The Star" },
  moon: { file: "18-TheMoon.png", title: "The Moon" },
  sun: { file: "19-TheSun.png", title: "The Sun" },
  justiciar: { file: "20-Judgement.png", title: "Judgement" },
  error: { file: "21-TheWorld.png", title: "The World" },
};

export function PathwayTarot({
  pathway,
  className,
  variant = "full",
}: {
  pathway: Pick<PathwayDefinition, "id" | "name" | "tarot">;
  className?: string;
  variant?: "full" | "compact";
}) {
  const card = RIDER_WAITE_CARDS[pathway.id];
  if (!card) return null;
  return <div className={cn("rws-card relative isolate overflow-hidden bg-[#ded1ae]", className)}>
    <Image
      src={"/tarot/" + card.file}
      alt={card.title + "，" + pathway.name + "途径对应牌面"}
      width={326}
      height={543}
      sizes={variant === "compact" ? "64px" : "(max-width:640px) 45vw, (max-width:1280px) 22vw, 230px"}
      className="h-auto w-full"
      unoptimized
    />
    <div className="rws-card-ink pointer-events-none absolute inset-0" aria-hidden="true" />
    {variant === "full" && <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between rounded-sm border border-[#b9a56f]/70 bg-[#071012]/88 px-3 py-2 text-[#eadfbe] backdrop-blur-sm"><span className="text-[10px] tracking-[.22em]">{pathway.tarot}</span><span className="serif text-xs">{pathway.name}途径</span></div>}
  </div>;
}
