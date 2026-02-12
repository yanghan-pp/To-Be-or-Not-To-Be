"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Question {
  id: number;
  question: string;
}

interface AnswerRecord {
  questionIndex: number;
  question: string;
  answer: string;
  source: "user" | "agent" | "user_edited";
}

interface ChatMessage {
  type: "question" | "answer" | "system";
  content: string;
  questionIndex?: number;
  source?: string;
  editable?: boolean;
}

const AUTO_ANSWER_SECONDS = 20;

export default function QuestionnairePage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [personalityTags, setPersonalityTags] = useState<Record<string, unknown> | null>(null);
  const [userName, setUserName] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);

  // User input state
  const [userInput, setUserInput] = useState("");
  const [countdown, setCountdown] = useState(AUTO_ANSWER_SECONDS);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/questionnaire").then((r) => r.json()),
    ])
      .then(([user, data]) => {
        setUserName(user.name || "你的分身");
        if (data.completed) {
          setCompleted(true);
          setPersonalityTags(data.personalityTags);
          return;
        }
        setQuestions(data.questions);
        const answered = data.answers?.length || 0;
        setCurrentIndex(answered);

        const history: ChatMessage[] = [];
        if (data.answers) {
          for (const a of data.answers as AnswerRecord[]) {
            history.push({ type: "question", content: a.question });
            history.push({
              type: "answer",
              content: a.answer,
              questionIndex: a.questionIndex,
              source: a.source,
              editable: true,
            });
          }
        }
        setMessages(history);

        if (answered < data.totalQuestions) {
          history.push({
            type: "question",
            content: data.questions[answered].question,
          });
          setMessages([...history]);
          setWaitingForInput(true);
          setCountdown(AUTO_ANSWER_SECONDS);
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Submit answer (user or agent)
  const submitAnswer = useCallback(
    async (mode: "user" | "agent", answer?: string) => {
      if (loading) return;
      setLoading(true);
      setWaitingForInput(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      try {
        const body: Record<string, unknown> = {
          questionIndex: currentIndex,
          mode,
        };
        if (mode === "user" && answer) {
          body.answer = answer;
        }

        const res = await fetch("/api/questionnaire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.error) {
          setMessages((prev) => [
            ...prev,
            { type: "system", content: `错误：${data.error}` },
          ]);
          setLoading(false);
          setWaitingForInput(true);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            type: "answer",
            content: data.answer,
            questionIndex: currentIndex,
            source: mode,
            editable: true,
          },
        ]);

        setUserInput("");

        if (data.completed) {
          setCompleted(true);
          setPersonalityTags(data.personalityTags);
          setMessages((prev) => [
            ...prev,
            { type: "system", content: "问卷完成！正在分析性格特征..." },
          ]);
        } else {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { type: "question", content: questions[nextIndex].question },
            ]);
            setWaitingForInput(true);
            setCountdown(AUTO_ANSWER_SECONDS);
          }, 600);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { type: "system", content: "网络错误，请重试" },
        ]);
        setWaitingForInput(true);
      } finally {
        setLoading(false);
      }
    },
    [loading, currentIndex, questions]
  );

  // Countdown timer for auto-answer
  useEffect(() => {
    if (!waitingForInput || loading) return;

    setCountdown(AUTO_ANSWER_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-trigger agent answer
          submitAnswer("agent");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    countdownRef.current = interval;

    return () => {
      clearInterval(interval);
      countdownRef.current = null;
    };
  }, [waitingForInput, loading, submitAnswer]);

  // User submits their own answer
  const handleUserSubmit = () => {
    if (!userInput.trim() || loading) return;
    submitAnswer("user", userInput.trim());
  };

  // Agent answers immediately (skip countdown)
  const handleAgentAnswer = () => {
    submitAnswer("agent");
  };

  // Edit an existing answer
  const startEditing = (qIndex: number, currentAnswer: string) => {
    setEditingIndex(qIndex);
    setEditText(currentAnswer);
  };

  const saveEdit = async () => {
    if (editingIndex === null || !editText.trim()) return;

    const res = await fetch("/api/questionnaire", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionIndex: editingIndex,
        newAnswer: editText.trim(),
      }),
    });
    const data = await res.json();

    if (data.success) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.questionIndex === editingIndex && msg.type === "answer"
            ? { ...msg, content: editText.trim(), source: "user_edited" }
            : msg
        )
      );
    }
    setEditingIndex(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  // AI auto-fill all remaining questions
  const handleAutoFillAll = async () => {
    if (loading || autoFilling || completed) return;
    setAutoFilling(true);
    setWaitingForInput(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto_all" }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { type: "system", content: `错误：${data.error}` },
        ]);
        setAutoFilling(false);
        setWaitingForInput(true);
        return;
      }

      // Animate each new answer appearing one by one
      const newAnswers = data.newAnswers as AnswerRecord[];
      for (let i = 0; i < newAnswers.length; i++) {
        const a = newAnswers[i];
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              { type: "question", content: a.question },
            ]);
            setTimeout(() => {
              setMessages((prev) => [
                ...prev,
                {
                  type: "answer",
                  content: a.answer,
                  questionIndex: a.questionIndex,
                  source: "agent",
                  editable: true,
                },
              ]);
              setCurrentIndex(a.questionIndex + 1);
              resolve();
            }, 400);
          }, i === 0 ? 0 : 600);
        });
      }

      setCompleted(true);
      setPersonalityTags(data.personalityTags);
      setMessages((prev) => [
        ...prev,
        { type: "system", content: "问卷完成！正在分析性格特征..." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { type: "system", content: "AI 自动填写失败，请重试" },
      ]);
      setWaitingForInput(true);
    } finally {
      setAutoFilling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col board-pattern">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur-md border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-xl text-gradient-gold">性格问卷</h1>
              <p className="text-xs text-ink-muted">探索 {userName} 的博弈性格</p>
            </div>
          </div>
          <div className="text-sm font-medium text-ink-muted">
            {currentIndex}/{questions.length || 10}
          </div>
        </div>
        <div className="h-1 bg-cream-dark">
          <div
            className="h-full bg-gradient-to-r from-gold to-gold-dark transition-all duration-500"
            style={{ width: `${(currentIndex / (questions.length || 10)) * 100}%` }}
          />
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-in-up ${
              msg.type === "question"
                ? "flex justify-start"
                : msg.type === "answer"
                ? "flex justify-end"
                : "flex justify-center"
            }`}
            style={{ animationDelay: `${Math.min(i * 0.03, 0.2)}s` }}
          >
            {msg.type === "question" && (
              <div className="max-w-[85%] game-card p-4 border-l-4 border-l-gold">
                <p className="text-xs font-medium text-gold-dark mb-1">提问</p>
                <p className="text-ink leading-relaxed">{msg.content}</p>
              </div>
            )}
            {msg.type === "answer" && (
              <div className="max-w-[85%] game-card p-4 border-r-4 border-r-steel bg-steel/5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-steel-dark">
                    {msg.source === "user" ? "你的回答" : msg.source === "user_edited" ? "你的回答（已编辑）" : `${userName} 的回答`}
                  </p>
                  {msg.editable && editingIndex !== msg.questionIndex && (
                    <button
                      onClick={() => startEditing(msg.questionIndex!, msg.content)}
                      className="text-xs text-ink-muted hover:text-steel transition-colors px-2 py-0.5 rounded hover:bg-steel/10"
                    >
                      编辑
                    </button>
                  )}
                </div>
                {editingIndex === msg.questionIndex ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-2 rounded-lg border border-steel/20 bg-white text-sm text-ink leading-relaxed resize-none focus:outline-none focus:border-steel"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit} className="text-xs px-3 py-1 rounded-lg text-ink-muted hover:bg-ink/5">
                        取消
                      </button>
                      <button onClick={saveEdit} className="text-xs px-3 py-1 rounded-lg bg-steel text-white hover:bg-steel-dark">
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-ink leading-relaxed">{msg.content}</p>
                )}
              </div>
            )}
            {msg.type === "system" && (
              <div className="bg-ink/5 rounded-full px-4 py-2 text-sm text-ink-muted">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-end animate-fade-in-up">
            <div className="max-w-[85%] game-card p-4 border-r-4 border-r-steel bg-steel/5">
              <p className="text-xs font-medium text-steel-dark mb-2">{userName} 正在思考...</p>
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 bg-steel rounded-full animate-thinking" style={{ animationDelay: "0s" }} />
                <span className="w-2.5 h-2.5 bg-steel rounded-full animate-thinking" style={{ animationDelay: "0.3s" }} />
                <span className="w-2.5 h-2.5 bg-steel rounded-full animate-thinking" style={{ animationDelay: "0.6s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Bottom action area */}
      <div className="sticky bottom-0 bg-cream/80 backdrop-blur-md border-t border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {autoFilling ? (
            <div className="text-center py-4 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 bg-gold rounded-full animate-thinking" style={{ animationDelay: "0s" }} />
                  <span className="w-2.5 h-2.5 bg-gold rounded-full animate-thinking" style={{ animationDelay: "0.3s" }} />
                  <span className="w-2.5 h-2.5 bg-gold rounded-full animate-thinking" style={{ animationDelay: "0.6s" }} />
                </div>
              </div>
              <p className="text-sm text-ink-muted">AI 正在自动填写所有问题，请稍候...</p>
            </div>
          ) : completed ? (
            <div className="text-center space-y-4">
              {personalityTags && (
                <div className="game-card p-4 animate-fade-in-up">
                  <p className="font-display text-lg text-gradient-gold mb-3">性格分析完成</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Array.isArray((personalityTags as Record<string, unknown>).tags) &&
                      ((personalityTags as Record<string, unknown>).tags as string[]).map((tag: string, i: number) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-gold/10 text-gold-dark text-sm font-medium">
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              <button onClick={() => router.push("/match")} className="btn-primary text-lg px-10 py-4">
                进入竞技场
              </button>
            </div>
          ) : waitingForInput && !loading ? (
            <div className="space-y-3">
              {/* Countdown bar */}
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <div className="flex-1 h-1.5 bg-cream-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-gold-dark rounded-full transition-all duration-1000"
                    style={{ width: `${(countdown / AUTO_ANSWER_SECONDS) * 100}%` }}
                  />
                </div>
                <span className="w-20 text-right">
                  {countdown}秒后自动回答
                </span>
              </div>

              {/* User input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUserSubmit()}
                  placeholder="输入你的回答，或等待 Agent 自动回答..."
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-card-border bg-white text-sm focus:outline-none focus:border-gold transition-colors"
                />
                <button
                  onClick={handleUserSubmit}
                  disabled={!userInput.trim()}
                  className={`px-5 py-3 rounded-xl text-sm font-medium transition-all ${
                    userInput.trim()
                      ? "btn-primary"
                      : "bg-cream-dark text-ink-muted cursor-not-allowed"
                  }`}
                >
                  提交
                </button>
              </div>

              {/* Quick agent answer button */}
              <div className="flex gap-2">
                <button
                  onClick={handleAgentAnswer}
                  className="flex-1 py-2.5 rounded-xl border-2 border-dashed border-steel/20 text-sm text-steel hover:bg-steel/5 hover:border-steel/40 transition-all"
                >
                  跳过，让 {userName} 自动回答
                </button>
                <button
                  onClick={handleAutoFillAll}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-sm text-white font-medium hover:shadow-lg transition-all"
                >
                  AI 一键自动填写所有问题
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-2 text-sm text-ink-muted">
              AI 分身正在回答中...
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
