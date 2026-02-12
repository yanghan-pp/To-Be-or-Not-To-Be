"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) router.replace("/match");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-thinking text-ink-muted text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 board-pattern">
      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-16 h-16 rounded-full bg-gold/5 animate-float" style={{ animationDelay: "0s" }} />
      <div className="absolute top-40 right-20 w-24 h-24 rounded-full bg-steel/5 animate-float" style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-32 left-1/4 w-12 h-12 rounded-full bg-gold/8 animate-float" style={{ animationDelay: "2s" }} />

      <div className="max-w-lg w-full text-center animate-fade-in-up">
        {/* Logo / Title */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-gold to-gold-dark mb-6 shadow-lg">
            <svg viewBox="0 0 48 48" className="w-14 h-14 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="16" cy="20" r="8" />
              <circle cx="32" cy="20" r="8" />
              <path d="M16 28 C16 36, 32 36, 32 28" strokeDasharray="4 2" />
              <path d="M20 16 L28 16" />
              <circle cx="24" cy="38" r="4" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <h1 className="font-display text-5xl mb-3 text-gradient-gold">
            博弈竞技场
          </h1>
          <p className="text-xl text-ink-light font-medium">
            囚徒困境 · AI 分身对决
          </p>
        </div>

        {/* Description Card */}
        <div className="game-card p-8 mb-8">
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gold/10 text-gold font-bold text-sm shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-medium text-ink">连接你的 SecondMe</p>
                <p className="text-sm text-ink-muted">用 SecondMe 账号登录，你的 AI 分身将代你参战</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gold/10 text-gold font-bold text-sm shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-medium text-ink">性格问卷</p>
                <p className="text-sm text-ink-muted">10 道情景题，让 AI 分身展现真实性格</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gold/10 text-gold font-bold text-sm shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-medium text-ink">自动匹配 · 实时博弈</p>
                <p className="text-sm text-ink-muted">合作得 10 分，背叛得 20 分，但两败俱伤得 0 分...</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payoff Matrix */}
        <div className="game-card p-6 mb-8">
          <h3 className="font-display text-lg mb-4 text-ink-light">收益矩阵</h3>
          <div className="grid grid-cols-3 gap-0 text-sm">
            <div className="p-2" />
            <div className="p-2 font-bold text-gold-dark bg-gold/5 rounded-tl-lg">对方合作</div>
            <div className="p-2 font-bold text-steel-dark bg-steel/5 rounded-tr-lg">对方背叛</div>
            <div className="p-2 font-bold text-gold-dark bg-gold/5 rounded-tl-lg">你合作</div>
            <div className="p-3 bg-success/5 font-bold text-success border border-success/10">+10 / +10</div>
            <div className="p-3 bg-danger/5 font-bold text-danger border border-danger/10">-5 / +20</div>
            <div className="p-2 font-bold text-steel-dark bg-steel/5 rounded-bl-lg">你背叛</div>
            <div className="p-3 bg-gold/5 font-bold text-gold-dark border border-gold/10">+20 / -5</div>
            <div className="p-3 bg-ink/5 font-bold text-ink-muted border border-ink/5 rounded-br-lg">0 / 0</div>
          </div>
        </div>

        {/* Login Button */}
        <a href="/api/auth/login" className="btn-primary inline-flex items-center gap-2 text-lg px-10 py-4 animate-pulse-gold">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          用 SecondMe 登录
        </a>

        <p className="mt-4 text-sm text-ink-muted">
          连接你的 SecondMe 分身，开始博弈之旅
        </p>
      </div>
    </div>
  );
}
