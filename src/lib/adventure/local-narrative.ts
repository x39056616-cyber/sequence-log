import type { StoryInputMode, TurnOperation, WorldState } from "@/lib/types";
import type { TurnAdjudication } from "@/lib/ai/turn-schema";
import { localOperationsFromInput, type WorldSnapshot } from "@/lib/adventure/state";
import { uid } from "@/lib/utils";

export function localChapter(input: { userInput: string; mode: StoryInputMode; worldState: WorldState; sequenceName: string; pathwayName: string; goal?: string }) {
  const intent = input.userInput.trim() || "继续观察眼前的局势";
  const modeLine = { action: "你决定采取行动", dialogue: "你开口打破了沉默", observe: "你把注意力投向细节", thought: "你在心中推演可能的结果", auto: "你的意志推动现实向前" }[input.mode];
  const location = input.worldState.location || "灰雾笼罩的街角";
  const time = input.worldState.timeLabel || "天色低沉";
  const goal = input.goal ? `你仍记得自己的长期目标：${input.goal}。` : "那些尚未解决的问题仍在远处等待。";
  const paragraphs = [
    `【${time}·${location}】灰雾像一层没有温度的纱，将熟悉的街道、砖墙与煤气灯拆分成彼此孤立的轮廓。远处偶尔传来车轮碾过湿石路的声音，很快又被雾吞没。作为${input.pathwayName}途径序列“${input.sequenceName}”的持有者，你很清楚眼前的安静并不等于安全，它只是某种更大变化到来前的间隙。`,
    `${modeLine}。你给出的选择是：“${intent}”。这句话一旦落入现实，就不再只是脑海里的假设。周围的细节开始沿着新的因果关系移动：一盏灯忽明忽暗，墙角的影子改变了方向，某扇没有完全关闭的窗后传来极轻的呼吸声。世界没有立刻同意你的愿望，但它开始对你的行动作出回应。`,
    `你首先确认自己能控制的部分。呼吸、重心、手中触碰到的物件、附近可退可进的路线，都比任何宏大的判断更可靠。${goal}你提醒自己，非凡者的力量并不是任意改写现实的许可，而是比普通人更早看见代价，并且仍然愿意为选择负责。`,
    `随着你继续推进，局势逐渐显露出两条方向。一条要求你立即介入，用确定性换取时间；另一条要求你保留观察，让更多证据浮现，但可能错过短暂窗口。灰雾深处像有一只没有睁开的眼睛，既没有赞许，也没有阻止，只是在记录你如何定义自己。`,
    `最终，你没有得到完整的答案，却得到了一条可继续追索的线索。它在你的记忆中留下清晰刻痕，也改变了你与当前人物、地点或危险之间的距离。若你愿意，可以继续输入行动或对白；系统推荐只是候选，不会替你做决定。`,
  ];
  paragraphs.push(
    `你没有急于把眼前的一切解释成明确的吉凶。占卜、灵感与预言都只是观察世界的方式，真正决定下一步的，仍是你愿意承担什么后果。你把呼吸放慢，重新确认身体与现实环境：脚下是否稳固，手边是否有可用之物，附近是否存在明确的出口，以及哪些行动会在不做准备的情况下把自己暴露给未知。灰雾没有给出赞扬，也没有投下惩罚；它只是像一个冷静的记录者，把每个选择写入后续的时间线。若你继续追问，人物与线索会逐渐靠近；若你转向现实，这段经历则可以成为一个安全、清晰、可完成的行动。`,
    `在离开当前场景之前，你保留了最低限度的谨慎。你记下无法解释的现象，也记下那些过于顺畅、因此值得怀疑的答案。某些信息可能来自善意，某些可能只是更高层次博弈故意留下的诱饵。你无法保证未来的每一回合都会按照预想展开，但可以保证自己的选择不是被动接受安排。随着最后一层灰雾缓慢合拢，当前章节暂时告一段落，下一段因果已经准备好等待你的输入。`,
  );  paragraphs.push(`你最后确认了一遍自己的界线：哪些信息可以分享，哪些只保留在本地；哪些行动今天能够完成，哪些需要更多时间与资源。这个判断本身也是非凡者应守住的锚点。灰雾之外，城市仍在运行，而你的现实生活并不会因为故事精彩就自动服从安排。最终，你带着一条可以继续验证的线索回到当下，准备在下一次输入中决定追问、行动、休息，或把它转化为现实委托。`);
  let text = paragraphs.join("\n\n");
  if (text.length < 1200) text += `\n\n你重新审视先前的选择。${goal}这一次行动并不会直接生成额外能力或奖励，但它会进入时间线。未来回合会读取当前世界状态、人物关系和已发现线索，而不是重新开始。`;
  return text;
}

export function localAdjudication(input: string, snapshot: WorldSnapshot): TurnAdjudication {
  const operations: TurnOperation[] = localOperationsFromInput(input, snapshot);
  return {
    operations: operations as never,
    suggestedChoices: [
      { id: uid(), label: "继续追问", description: "沿着刚刚出现的线索继续调查，确认它是否可信。" },
      { id: uid(), label: "转入现实", description: "将当前行动转化为一个安全、可执行的现实任务。" },
      { id: uid(), label: "保守观察", description: "暂时不介入，记录局势并等待下一次变化。" },
    ],
    summaryDelta: "用户采取行动：" + input.slice(0, 120),
  };
}




