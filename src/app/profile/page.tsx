"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  totalScore: number;
  gamesPlayed: number;
}

interface PersonalityData {
  cooperation_tendency?: number;
  trust_level?: number;
  risk_tolerance?: number;
  forgiveness?: number;
  rationality?: number;
  tags?: string[];
}

interface GameHistory {
  id: string;
  totalRounds: number;
  agent1Score: number;
  agent2Score: number;
  status: string;
  agent1: { id: string; name: string };
  agent2: { id: string; name: string };
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [personality, setPersonality] = useState<PersonalityData | null>(null);
  const [games, setGames] = useState<GameHistory[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((userData) => {
        setUser(userData);
        return fetch("/api/questionnaire");
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.personalityTags) {
          setPersonality(data.personalityTags);
        }
      })
      .catch(() => router.replace("/"));

    fetch("/api/profile/games")
      .then((r) => (r.ok ? r.json() : { games: [] }))
      .then((data) => setGames(data.games || []))
      .catch(() => {});
  }, [router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-thinking text-ink-muted">加载中...</div>
      </div>
    );
  }

  const statBar = (label: string, value: number, color: string) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-2 bg-cream-dark rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen board-pattern">
      {/* Nav */}
      <nav className="bg-cream/80 backdrop-blur-md border-b border-card-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/match" className="font-display text-2xl text-gradient-gold">
            博弈竞技场
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/match" className="text-sm text-ink-muted hover:text-gold transition-colors">
              开始匹配
            </Link>
            <Link href="/leaderboard" className="text-sm text-ink-muted hover:text-gold transition-colors">
              排行榜
            </Link>
            <a href="/api/auth/logout" className="text-sm text-danger hover:text-danger/80 transition-colors">
              登出
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Profile Card */}
        <div className="game-card p-8 mb-8 animate-fade-in-up">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-white text-3xl font-bold shadow-xl">
              {user.name?.[0] || "?"}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <p className="text-sm text-ink-muted">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gold/5 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-gradient-gold">{user.totalScore}</p>
              <p className="text-sm text-ink-muted mt-1">总积分</p>
            </div>
            <div className="bg-steel/5 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-gradient-steel">{user.gamesPlayed}</p>
              <p className="text-sm text-ink-muted mt-1">博弈场次</p>
            </div>
          </div>
        </div>

        {/* Personality Analysis */}
        {personality && (
          <div className="game-card p-6 mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="font-display text-xl text-gradient-gold mb-4">性格分析</h2>
            {personality.tags && (
              <div className="flex flex-wrap gap-2 mb-5">
                {personality.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-gold/10 text-gold-dark text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {personality.cooperation_tendency !== undefined && statBar("合作倾向", personality.cooperation_tendency, "bg-gradient-to-r from-gold to-gold-dark")}
              {personality.trust_level !== undefined && statBar("信任水平", personality.trust_level, "bg-gradient-to-r from-success to-green-600")}
              {personality.risk_tolerance !== undefined && statBar("风险容忍度", personality.risk_tolerance, "bg-gradient-to-r from-danger to-red-600")}
              {personality.forgiveness !== undefined && statBar("宽容度", personality.forgiveness, "bg-gradient-to-r from-steel to-steel-dark")}
              {personality.rationality !== undefined && statBar("理性程度", personality.rationality, "bg-gradient-to-r from-purple-500 to-purple-700")}
            </div>
          </div>
        )}

        {/* Game History */}
        <div className="game-card p-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <h2 className="font-display text-xl text-gradient-gold mb-4">博弈历史</h2>
          {games.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-ink-muted">还没有博弈记录</p>
              <Link href="/match" className="btn-primary inline-block mt-4">
                开始第一场
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const isAgent1 = user.id === game.agent1.id;
                const myScore = isAgent1 ? game.agent1Score : game.agent2Score;
                const oppScore = isAgent1 ? game.agent2Score : game.agent1Score;
                const opponent = isAgent1 ? game.agent2 : game.agent1;
                const won = myScore > oppScore;
                const tied = myScore === oppScore;

                return (
                  <Link
                    key={game.id}
                    href={`/game/${game.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-cream/50 hover:bg-cream-dark/50 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                      won ? "bg-success" : tied ? "bg-ink-muted" : "bg-danger"
                    }`}>
                      {won ? "胜" : tied ? "平" : "负"}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">vs {opponent.name || "匿名"}</p>
                      <p className="text-xs text-ink-muted">{game.totalRounds} 轮</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        <span className={myScore >= 0 ? "text-success" : "text-danger"}>{myScore}</span>
                        <span className="text-ink-muted mx-1">:</span>
                        <span className="text-ink-muted">{oppScore}</span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
