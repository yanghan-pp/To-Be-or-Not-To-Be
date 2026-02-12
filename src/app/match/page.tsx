"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  avatarUrl: string | null;
  totalScore: number;
  gamesPlayed: number;
}

interface GameData {
  id: string;
  agent1: { id: string; name: string; avatarUrl: string | null };
  agent2: { id: string; name: string; avatarUrl: string | null };
  totalRounds: number;
}

export default function MatchPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "searching" | "matched" | "waiting">("loading");
  const [matchedGame, setMatchedGame] = useState<GameData | null>(null);
  const [dots, setDots] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const matchAttempted = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((userData) => {
        setUser(userData);
        // Auto-start matching immediately
        if (!matchAttempted.current) {
          matchAttempted.current = true;
          startMatch();
        }
      })
      .catch(() => router.replace("/"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (status !== "searching") return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  // Auto-retry matching when waiting
  useEffect(() => {
    if (status !== "waiting") return;
    const timer = setTimeout(() => {
      setRetryCount((c) => c + 1);
      startMatch();
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, retryCount]);

  const startMatch = async () => {
    setStatus("searching");

    try {
      const res = await fetch("/api/game/match", { method: "POST" });
      const data = await res.json();

      if (data.status === "matched" || data.status === "already_playing") {
        setMatchedGame(data.game);
        setStatus("matched");
        setTimeout(() => {
          router.push(`/game/${data.game.id}`);
        }, 1500);
      } else {
        setStatus("waiting");
      }
    } catch {
      setStatus("waiting");
    }
  };

  if (!user || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-thinking text-ink-muted">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen board-pattern">
      {/* Nav */}
      <nav className="bg-cream/80 backdrop-blur-md border-b border-card-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl text-gradient-gold">
            博弈竞技场
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/leaderboard" className="text-sm text-ink-muted hover:text-gold transition-colors">
              排行榜
            </Link>
            <Link href="/profile" className="text-sm text-ink-muted hover:text-gold transition-colors">
              个人主页
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-white text-xs font-bold">
                {user.name?.[0] || "?"}
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* User stats card */}
        <div className="game-card p-6 mb-8 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {user.name?.[0] || "?"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-sm text-ink-muted">SecondMe 分身</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gradient-gold">{user.totalScore}</p>
              <p className="text-xs text-ink-muted">总积分 · {user.gamesPlayed} 场</p>
            </div>
          </div>
        </div>

        {/* Match area */}
        <div className="game-card p-8 text-center animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {status === "searching" && (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold/10 mb-4 animate-pulse-gold">
                  <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
                <h2 className="font-display text-3xl mb-2">正在匹配{dots}</h2>
                <p className="text-ink-muted">正在为你的分身寻找一位合适的对手</p>
              </div>
            </>
          )}

          {status === "matched" && matchedGame && (
            <>
              <div className="mb-6 animate-score-reveal">
                <div className="flex items-center justify-center gap-8 mb-6">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-white text-xl font-bold shadow-lg mb-2">
                      {matchedGame.agent1.name?.[0] || "?"}
                    </div>
                    <p className="text-sm font-medium">{matchedGame.agent1.name}</p>
                  </div>
                  <div className="font-display text-3xl text-gold">VS</div>
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-steel to-steel-dark flex items-center justify-center text-white text-xl font-bold shadow-lg mb-2">
                      {matchedGame.agent2.name?.[0] || "?"}
                    </div>
                    <p className="text-sm font-medium">{matchedGame.agent2.name}</p>
                  </div>
                </div>
                <h2 className="font-display text-3xl mb-2 text-gradient-gold">匹配成功！</h2>
                <p className="text-ink-muted">共 {matchedGame.totalRounds} 轮博弈，即将开始...</p>
              </div>
            </>
          )}

          {status === "waiting" && (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-steel/10 mb-4 animate-pulse-gold">
                  <svg className="w-10 h-10 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="font-display text-2xl mb-2 text-ink-light">正在等待对手...</h2>
                <p className="text-ink-muted">暂时没有可匹配的对手，系统会自动重试</p>
                <p className="text-xs text-ink-muted mt-2">已重试 {retryCount} 次</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
