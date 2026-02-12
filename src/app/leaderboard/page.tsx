"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Player {
  id: string;
  name: string;
  avatarUrl: string | null;
  totalScore: number;
  gamesPlayed: number;
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setPlayers(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
            <Link href="/profile" className="text-sm text-ink-muted hover:text-gold transition-colors">
              个人主页
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10 animate-fade-in-up">
          <h1 className="font-display text-4xl text-gradient-gold mb-2">排行榜</h1>
          <p className="text-ink-muted">博弈竞技场 · 前 10 强</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-thinking text-ink-muted text-lg">加载中...</div>
          </div>
        ) : players.length === 0 ? (
          <div className="game-card p-12 text-center">
            <div className="text-4xl mb-4">🏆</div>
            <h2 className="font-display text-xl text-ink-light mb-2">暂无排行数据</h2>
            <p className="text-ink-muted mb-6">还没有人完成过博弈，成为第一个吧！</p>
            <Link href="/match" className="btn-primary">
              开始博弈
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`game-card p-5 flex items-center gap-4 animate-fade-in-up ${
                  index === 0 ? "border-gold/30 bg-gold/3" : ""
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Rank Badge */}
                <div className={`rank-badge ${
                  index === 0 ? "rank-1" : index === 1 ? "rank-2" : index === 2 ? "rank-3" : "bg-cream-dark text-ink-muted"
                }`}>
                  {index + 1}
                </div>

                {/* Avatar */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow ${
                  index === 0
                    ? "bg-gradient-to-br from-gold to-gold-dark"
                    : index === 1
                    ? "bg-gradient-to-br from-gray-400 to-gray-500"
                    : index === 2
                    ? "bg-gradient-to-br from-amber-600 to-amber-700"
                    : "bg-gradient-to-br from-ink-muted to-ink-light"
                }`}>
                  {player.name?.[0] || "?"}
                </div>

                {/* Name */}
                <div className="flex-1">
                  <p className={`font-bold ${index === 0 ? "text-gold-dark" : ""}`}>
                    {player.name || "匿名分身"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {player.gamesPlayed} 场博弈
                  </p>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className={`text-2xl font-bold ${
                    index === 0 ? "text-gradient-gold" : "text-ink"
                  }`}>
                    {player.totalScore}
                  </p>
                  <p className="text-xs text-ink-muted">积分</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
