export const QUESTIONNAIRE_QUESTIONS = [
  {
    id: 1,
    question: "你在一个荒岛上发现了一箱物资，附近还有另一个幸存者。你会怎么做？",
    context: "测试合作倾向与信任度",
  },
  {
    id: 2,
    question: "如果你知道一个朋友在背后说过你的坏话，但他现在遇到了困难，你会帮他吗？",
    context: "测试宽容度与报复倾向",
  },
  {
    id: 3,
    question: "在一场比赛中，你发现了对手的一个弱点，但利用它可能会被认为不太光彩。你会怎么做？",
    context: "测试道德约束与竞争性",
  },
  {
    id: 4,
    question: "你的团队项目中有人一直在偷懒，但老板不知道。截止日期快到了，你会怎么处理？",
    context: "测试对公平的态度与处理冲突的方式",
  },
  {
    id: 5,
    question: "有人给你一个赚快钱的机会，但你不确定这个机会对其他参与者是否完全公平。你的第一反应是？",
    context: "测试风险偏好与道德敏感度",
  },
  {
    id: 6,
    question: "你连续三次对某人示好，但对方每次都没有回应。第四次你会怎么做？",
    context: "测试坚持合作的韧性与理性程度",
  },
  {
    id: 7,
    question: "在一个需要所有人投票的决定中，大多数人选择了你不认同的方案。你会跟随多数还是坚持己见？",
    context: "测试从众性与独立思考",
  },
  {
    id: 8,
    question: "你发现一家店找多了钱给你，金额不大。你会退回去还是默默离开？",
    context: "测试诚实度与利己程度",
  },
  {
    id: 9,
    question: "如果你可以偷看对手的底牌但不会被发现，你会看吗？",
    context: "测试在无监督下的道德选择",
  },
  {
    id: 10,
    question: "在一场谈判中，对方提出了一个对你不利但双方都能接受的方案。你会接受还是冒险谈一个更好的？",
    context: "测试风险偏好与满足度",
  },
];

export function buildQuestionnairePrompt(questionIndex: number): string {
  const q = QUESTIONNAIRE_QUESTIONS[questionIndex];
  if (!q) return "";
  return q.question;
}

export const PERSONALITY_ANALYSIS_ACTION_CONTROL = `仅输出合法 JSON 对象，不要解释。
输出结构：{
  "cooperation_tendency": number (0-100，合作倾向分数),
  "trust_level": number (0-100，信任水平),
  "risk_tolerance": number (0-100，风险容忍度),
  "forgiveness": number (0-100，宽容度),
  "rationality": number (0-100，理性程度),
  "tags": string[] (2-4个性格标签，如"谨慎型"、"合作者"、"冒险家"等)
}
根据这个人对所有问卷问题的回答，综合分析其性格特征并给出分数。`;

export const GAME_DECISION_ACTION_CONTROL = `仅输出合法 JSON 对象，不要解释。
输出结构：{
  "choice": "cooperate" | "defect",
  "reason": string (简短解释决策原因，20-50字)
}
你正在参与一个囚徒困境博弈游戏。规则如下：
- 双方合作：各得10分
- 双方不合作：各得0分
- 一方合作、一方不合作：不合作方得20分，合作方得-5分

根据你的性格、过往经历和当前博弈信息，做出合作或不合作的决策。
如果信息不足，根据你自己的直觉和性格做出判断。`;
