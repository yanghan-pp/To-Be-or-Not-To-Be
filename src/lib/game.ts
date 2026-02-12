export type Choice = "cooperate" | "defect";

export interface RoundResult {
  agent1Points: number;
  agent2Points: number;
}

export function calculateRoundScore(
  agent1Choice: Choice,
  agent2Choice: Choice
): RoundResult {
  if (agent1Choice === "cooperate" && agent2Choice === "cooperate") {
    return { agent1Points: 10, agent2Points: 10 };
  }
  if (agent1Choice === "defect" && agent2Choice === "defect") {
    return { agent1Points: 0, agent2Points: 0 };
  }
  if (agent1Choice === "cooperate" && agent2Choice === "defect") {
    return { agent1Points: -5, agent2Points: 20 };
  }
  // agent1 defect, agent2 cooperate
  return { agent1Points: 20, agent2Points: -5 };
}

export function generateTotalRounds(): number {
  return Math.floor(Math.random() * 48) + 3; // 3-50 rounds
}

export function buildGameContext(
  opponentName: string,
  roundNumber: number,
  totalRounds: number,
  history: Array<{
    round: number;
    myChoice: Choice;
    opponentChoice: Choice;
    myPoints: number;
    opponentPoints: number;
  }>,
  personalityTags: string[]
): string {
  let context = `你正在与「${opponentName}」进行囚徒困境博弈。\n`;
  context += `当前是第 ${roundNumber}/${totalRounds} 轮。\n`;

  if (personalityTags.length > 0) {
    context += `你的性格标签：${personalityTags.join("、")}。\n`;
  }

  if (history.length > 0) {
    context += `\n之前的博弈记录：\n`;
    for (const h of history) {
      const myAction = h.myChoice === "cooperate" ? "合作" : "不合作";
      const opAction = h.opponentChoice === "cooperate" ? "合作" : "不合作";
      context += `第${h.round}轮：你选择${myAction}，对方选择${opAction}（你得${h.myPoints}分，对方得${h.opponentPoints}分）\n`;
    }
  }

  context += `\n请做出本轮决策。`;
  return context;
}
