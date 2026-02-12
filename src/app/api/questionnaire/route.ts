import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserAccessToken } from "@/lib/auth";
import {
  QUESTIONNAIRE_QUESTIONS,
  buildQuestionnairePrompt,
  PERSONALITY_ANALYSIS_ACTION_CONTROL,
} from "@/lib/questionnaire";
import { chatWithSecondMe, actWithSecondMe } from "@/lib/secondme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Get current questionnaire status
export async function GET() {
  const { prisma } = await import("@/lib/prisma");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    completed: questionnaire?.completed ?? false,
    answers: questionnaire ? JSON.parse(questionnaire.answers) : [],
    personalityTags: questionnaire?.personalityTags
      ? JSON.parse(questionnaire.personalityTags)
      : null,
    totalQuestions: QUESTIONNAIRE_QUESTIONS.length,
    questions: QUESTIONNAIRE_QUESTIONS.map((q) => ({
      id: q.id,
      question: q.question,
    })),
  });
}

// POST: Submit a questionnaire answer
// Supports three modes:
//   { questionIndex, mode: "agent" }       — Agent auto-answer via Chat API
//   { questionIndex, mode: "user", answer } — User provides their own answer
//   { mode: "auto_all" }                   — Agent auto-answers ALL remaining questions
export async function POST(request: NextRequest) {
  const { prisma } = await import("@/lib/prisma");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { mode } = body;

  // --- auto_all mode: answer all remaining questions at once ---
  if (mode === "auto_all") {
    const accessToken = await getUserAccessToken(user.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Token 无效" }, { status: 401 });
    }

    try {
      let questionnaire = await prisma.questionnaire.findUnique({
        where: { userId: user.id },
      });

      const currentAnswers: Array<{
        questionIndex: number;
        question: string;
        answer: string;
        source: string;
      }> = questionnaire ? JSON.parse(questionnaire.answers) : [];

      const answeredIndices = new Set(
        currentAnswers.map((a) => a.questionIndex)
      );

      const newAnswers: Array<{
        questionIndex: number;
        question: string;
        answer: string;
        source: string;
      }> = [];

      // Answer all remaining questions sequentially
      for (let i = 0; i < QUESTIONNAIRE_QUESTIONS.length; i++) {
        if (answeredIndices.has(i)) continue;
        const questionText = buildQuestionnairePrompt(i);
        if (!questionText) continue;

        const chatResult = await chatWithSecondMe(accessToken, questionText);
        const entry = {
          questionIndex: i,
          question: questionText,
          answer: chatResult.text,
          source: "agent",
        };
        currentAnswers.push(entry);
        newAnswers.push(entry);
      }

      // Save all answers
      if (!questionnaire) {
        questionnaire = await prisma.questionnaire.create({
          data: {
            userId: user.id,
            answers: JSON.stringify(currentAnswers),
            completed: true,
          },
        });
      } else {
        questionnaire = await prisma.questionnaire.update({
          where: { id: questionnaire.id },
          data: {
            answers: JSON.stringify(currentAnswers),
            completed: true,
          },
        });
      }

      // Analyze personality
      let personalityTags = null;
      const allAnswersText = currentAnswers
        .map(
          (a) => `问题：${a.question}\n回答：${a.answer}`
        )
        .join("\n\n");

      try {
        const analysis = await actWithSecondMe(
          accessToken,
          allAnswersText,
          PERSONALITY_ANALYSIS_ACTION_CONTROL
        );
        personalityTags = analysis.result;

        await prisma.questionnaire.update({
          where: { id: questionnaire.id },
          data: {
            personalityTags: JSON.stringify(personalityTags),
          },
        });
      } catch (err) {
        console.error("Personality analysis failed:", err);
      }

      return NextResponse.json({
        newAnswers,
        completed: true,
        personalityTags,
      });
    } catch (error) {
      console.error("Auto-all error:", error);
      return NextResponse.json(
        { error: "AI 自动填写失败" },
        { status: 500 }
      );
    }
  }

  // --- Single question mode ---
  const { questionIndex, answer: userAnswer } = body;

  const question = buildQuestionnairePrompt(questionIndex);
  if (!question) {
    return NextResponse.json({ error: "无效的题目索引" }, { status: 400 });
  }

  let answerText: string;

  if (mode === "user" && userAnswer) {
    // User provided their own answer
    answerText = userAnswer;
  } else {
    // Agent auto-answer via Chat API
    const accessToken = await getUserAccessToken(user.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Token 无效" }, { status: 401 });
    }
    try {
      const chatResult = await chatWithSecondMe(accessToken, question);
      answerText = chatResult.text;
    } catch (error) {
      console.error("Agent answer error:", error);
      return NextResponse.json({ error: "Agent 回答失败" }, { status: 500 });
    }
  }

  try {
    let questionnaire = await prisma.questionnaire.findUnique({
      where: { userId: user.id },
    });

    const currentAnswers = questionnaire
      ? JSON.parse(questionnaire.answers)
      : [];

    currentAnswers.push({
      questionIndex,
      question,
      answer: answerText,
      source: mode === "user" ? "user" : "agent",
    });

    const isComplete =
      currentAnswers.length >= QUESTIONNAIRE_QUESTIONS.length;

    if (!questionnaire) {
      questionnaire = await prisma.questionnaire.create({
        data: {
          userId: user.id,
          answers: JSON.stringify(currentAnswers),
          completed: isComplete,
        },
      });
    } else {
      questionnaire = await prisma.questionnaire.update({
        where: { id: questionnaire.id },
        data: {
          answers: JSON.stringify(currentAnswers),
          completed: isComplete,
        },
      });
    }

    // If all questions answered, analyze personality
    let personalityTags = null;
    if (isComplete) {
      const accessToken = await getUserAccessToken(user.id);
      if (accessToken) {
        const allAnswers = currentAnswers
          .map(
            (a: { question: string; answer: string }) =>
              `问题：${a.question}\n回答：${a.answer}`
          )
          .join("\n\n");

        try {
          const analysis = await actWithSecondMe(
            accessToken,
            allAnswers,
            PERSONALITY_ANALYSIS_ACTION_CONTROL
          );

          personalityTags = analysis.result;

          await prisma.questionnaire.update({
            where: { id: questionnaire.id },
            data: {
              personalityTags: JSON.stringify(personalityTags),
            },
          });
        } catch (err) {
          console.error("Personality analysis failed:", err);
        }
      }
    }

    return NextResponse.json({
      answer: answerText,
      currentIndex: questionIndex,
      totalAnswered: currentAnswers.length,
      completed: isComplete,
      personalityTags,
    });
  } catch (error) {
    console.error("Questionnaire error:", error);
    return NextResponse.json(
      { error: "问卷处理失败" },
      { status: 500 }
    );
  }
}

// PUT: Edit an existing answer
export async function PUT(request: NextRequest) {
  const { prisma } = await import("@/lib/prisma");

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { questionIndex, newAnswer } = await request.json();

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { userId: user.id },
  });

  if (!questionnaire) {
    return NextResponse.json({ error: "问卷不存在" }, { status: 404 });
  }

  const answers = JSON.parse(questionnaire.answers);
  const target = answers.find(
    (a: { questionIndex: number }) => a.questionIndex === questionIndex
  );

  if (!target) {
    return NextResponse.json({ error: "该题目尚未回答" }, { status: 404 });
  }

  target.answer = newAnswer;
  target.source = "user_edited";

  await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: { answers: JSON.stringify(answers) },
  });

  return NextResponse.json({ success: true, answers });
}
