"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface RoundData {
  roundNumber: number;
  agent1Choice: string;
  agent2Choice: string;
  agent1Reason: string;
  agent2Reason: string;
  agent1Points: number;
  agent2Points: number;
}

interface AgentData {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface GameState {
  id: string;
  totalRounds: number;
  currentRound: number;
  agent1Score: number;
  agent2Score: number;
  status: string;
  agent1: AgentData;
  agent2: AgentData;
  rounds: RoundData[];
}

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<GameState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "reveal" | "done">("idle");
  const [userId, setUserId] = useState("");
  const [autoStarted, setAutoStarted] = useState(false);
  const gameRef = useRef<GameState | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/game/${id}`).then((r) => r.json()),
    ])
      .then(([user, data]) => {
        setUserId(user.id);
        setGame(data.game);
        if (data.game.status === "finished") {
          setPhase("done");
        }
      })
      .catch(() => router.replace("/match"));
  }, [id, router]);

  const playRound = useCallback(async () => {
    const currentGame = gameRef.current;
    if (playingRef.current || !currentGame) return;
    playingRef.current = true;
    setPlaying(true);
    setPhase("thinking");
    setCurrentRound(null);
    setShowingResult(false);

    try {
      const res = await fetch("/api/game/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: currentGame.id }),
      });
      const data = await res.json();

      if (data.error) {
        setPhase("idle");
        return;
      }

      // Show result with animation
      setCurrentRound(data.round);
      setPhase("reveal");

      setTimeout(() => {
        setShowingResult(true);
      }, 600);

      // Update game state
      setGame((prev) =>
        prev
          ? {
              ...prev,
              currentRound: data.game.currentRound,
              agent1Score: data.game.agent1Score,
              agent2Score: data.game.agent2Score,
              status: data.game.isGameOver ? "finished" : "playing",
              rounds: [...prev.rounds, data.round],
            }
          : null
      );

      if (data.game.isGameOver) {
        setTimeout(() => setPhase("done"), 3000);
      } else {
        // Auto-play next round after 3 seconds
        setTimeout(() => {
          playingRef.current = false;
          setPlaying(false);
          playRound();
        }, 3000);
        return; // Don't reset playing in finally
      }
    } catch {
      setPhase("idle");
    } finally {
      playingRef.current = false;
      setPlaying(false);
    }
  }, []);

  // Auto-start game when loaded
  useEffect(() => {
    if (game && game.status === "playing" && !autoStarted && !playing) {
      setAutoStarted(true);
      // Small delay for user to see the scoreboard
      const timer = setTimeout(() => {
        playRound();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [game, autoStarted, playing, playRound]);

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-thinking text-ink-muted">加载游戏中...</div>
      </div>
    );
  }

  const isAgent1 = userId === game.agent1.id;
  const myAgent = isAgent1 ? game.agent1 : game.agent2;
  const opponent = isAgent1 ? game.agent2 : game.agent1;
  const myScore = isAgent1 ? game.agent1Score : game.agent2Score;
  const opponentScore = isAgent1 ? game.agent2Score : game.agent1Score;

  const choiceLabel = (c: string) => (c === "cooperate" ? "合作" : "背叛");
  const choiceColor = (c: string) =>
    c === "cooperate" ? "text-gold-dark bg-gold/10 border-gold/20" : "text-steel-dark bg-steel/10 border-steel/20";
  const choiceGlow = (c: string) =>
    c === "cooperate" ? "cooperate-glow" : "defect-glow";

  return (
    <div className="min-h-screen board-pattern">
      {/* Nav */}
      <nav className="bg-cream/80 backdrop-blur-md border-b border-card-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/match" className="font-display text-2xl text-gradient-gold">
            博弈竞技场
          </Link>
          <div className="text-sm text-ink-muted">
            第 {game.currentRound} 轮
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Score Board */}
        <div className="game-card p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 animate-slide-left">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-white text-lg font-bold shadow-lg">
                {myAgent.name?.[0] || "?"}
              </div>
              <div>
                <p className="font-bold">{myAgent.name}</p>
                <p className="text-xs text-ink-muted">你的分身</p>
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-gradient-gold">{myScore}</span>
                <span className="text-xl text-ink-muted font-display">VS</span>
                <span className="text-3xl font-bold text-gradient-steel">{opponentScore}</span>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                {game.status === "finished" ? "最终比分" : `第 ${game.currentRound} 轮`}
              </p>
            </div>

            <div className="flex items-center gap-3 animate-slide-right">
              <div className="text-right">
                <p className="font-bold">{opponent.name}</p>
                <p className="text-xs text-ink-muted">对手分身</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-steel to-steel-dark flex items-center justify-center text-white text-lg font-bold shadow-lg">
                {opponent.name?.[0] || "?"}
              </div>
            </div>
          </div>
        </div>

        {/* Current Round Display */}
        {phase === "thinking" && (
          <div className="game-card p-8 mb-6 text-center animate-fade-in-up">
            <div className="flex items-center justify-center gap-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-2 animate-pulse-gold">
                  <span className="text-2xl animate-thinking">🤔</span>
                </div>
                <p className="text-sm font-medium">{myAgent.name}</p>
                <p className="text-xs text-ink-muted">思考中...</p>
              </div>
              <div className="font-display text-2xl text-ink-muted animate-thinking">⚔️</div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-steel/10 flex items-center justify-center mb-2 animate-pulse-gold">
                  <span className="text-2xl animate-thinking">🤔</span>
                </div>
                <p className="text-sm font-medium">{opponent.name}</p>
                <p className="text-xs text-ink-muted">思考中...</p>
              </div>
            </div>
            <p className="mt-4 text-ink-muted">双方 AI 分身正在思考决策...</p>
          </div>
        )}

        {phase === "reveal" && currentRound && (
          <div className="game-card p-8 mb-6 animate-fade-in-up">
            <h3 className="font-display text-xl text-center mb-6">
              第 {currentRound.roundNumber} 轮结果
            </h3>
            <div className="flex items-start justify-between gap-4">
              {/* My agent's choice */}
              <div className={`flex-1 game-card p-4 text-center ${showingResult ? choiceGlow(isAgent1 ? currentRound.agent1Choice : currentRound.agent2Choice) : ""}`}>
                <p className="text-sm font-medium mb-2">{myAgent.name}</p>
                {showingResult ? (
                  <div className="animate-score-reveal">
                    <span className={`inline-block px-4 py-2 rounded-xl text-lg font-bold border ${choiceColor(isAgent1 ? currentRound.agent1Choice : currentRound.agent2Choice)}`}>
                      {choiceLabel(isAgent1 ? currentRound.agent1Choice : currentRound.agent2Choice)}
                    </span>
                    <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                      {isAgent1 ? currentRound.agent1Reason : currentRound.agent2Reason}
                    </p>
                    <p className={`mt-2 text-xl font-bold ${(isAgent1 ? currentRound.agent1Points : currentRound.agent2Points) > 0 ? "text-success" : (isAgent1 ? currentRound.agent1Points : currentRound.agent2Points) < 0 ? "text-danger" : "text-ink-muted"}`}>
                      {(isAgent1 ? currentRound.agent1Points : currentRound.agent2Points) > 0 ? "+" : ""}
                      {isAgent1 ? currentRound.agent1Points : currentRound.agent2Points}
                    </p>
                  </div>
                ) : (
                  <div className="animate-thinking text-3xl">❓</div>
                )}
              </div>

              <div className="self-center font-display text-xl text-ink-muted">VS</div>

              {/* Opponent's choice */}
              <div className={`flex-1 game-card p-4 text-center ${showingResult ? choiceGlow(isAgent1 ? currentRound.agent2Choice : currentRound.agent1Choice) : ""}`}>
                <p className="text-sm font-medium mb-2">{opponent.name}</p>
                {showingResult ? (
                  <div className="animate-score-reveal">
                    <span className={`inline-block px-4 py-2 rounded-xl text-lg font-bold border ${choiceColor(isAgent1 ? currentRound.agent2Choice : currentRound.agent1Choice)}`}>
                      {choiceLabel(isAgent1 ? currentRound.agent2Choice : currentRound.agent1Choice)}
                    </span>
                    <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                      {isAgent1 ? currentRound.agent2Reason : currentRound.agent1Reason}
                    </p>
                    <p className={`mt-2 text-xl font-bold ${(isAgent1 ? currentRound.agent2Points : currentRound.agent1Points) > 0 ? "text-success" : (isAgent1 ? currentRound.agent2Points : currentRound.agent1Points) < 0 ? "text-danger" : "text-ink-muted"}`}>
                      {(isAgent1 ? currentRound.agent2Points : currentRound.agent1Points) > 0 ? "+" : ""}
                      {isAgent1 ? currentRound.agent2Points : currentRound.agent1Points}
                    </p>
                  </div>
                ) : (
                  <div className="animate-thinking text-3xl">❓</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Game History */}
        {game.rounds.length > 0 && (
          <div className="game-card p-6 mb-6">
            <h3 className="font-display text-lg mb-4 text-ink-light">博弈记录</h3>
            <div className="space-y-2">
              {game.rounds.map((round, i) => {
                const myChoice = isAgent1 ? round.agent1Choice : round.agent2Choice;
                const oppChoice = isAgent1 ? round.agent2Choice : round.agent1Choice;
                const myPts = isAgent1 ? round.agent1Points : round.agent2Points;
                const oppPts = isAgent1 ? round.agent2Points : round.agent1Points;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-cream/50 text-sm"
                  >
                    <span className="text-ink-muted w-16">第 {round.roundNumber} 轮</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${choiceColor(myChoice)}`}>
                      {choiceLabel(myChoice)}
                    </span>
                    <span className="text-ink-muted text-xs">vs</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${choiceColor(oppChoice)}`}>
                      {choiceLabel(oppChoice)}
                    </span>
                    <span className={`font-bold w-16 text-right ${myPts > 0 ? "text-success" : myPts < 0 ? "text-danger" : "text-ink-muted"}`}>
                      {myPts > 0 ? "+" : ""}{myPts}
                    </span>
                    <span className={`font-bold w-16 text-right ${oppPts > 0 ? "text-success" : oppPts < 0 ? "text-danger" : "text-ink-muted"}`}>
                      {oppPts > 0 ? "+" : ""}{oppPts}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="text-center mt-8">
          {phase === "done" && (
            <div className="animate-fade-in-up space-y-4">
              <div className="game-card p-8 text-center">
                <h2 className="font-display text-3xl mb-4 text-gradient-gold">博弈结束</h2>
                <div className="flex items-center justify-center gap-8 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gradient-gold">{myScore}</p>
                    <p className="text-sm text-ink-muted">{myAgent.name}</p>
                  </div>
                  <span className="text-2xl text-ink-muted">:</span>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gradient-steel">{opponentScore}</p>
                    <p className="text-sm text-ink-muted">{opponent.name}</p>
                  </div>
                </div>
                <p className="text-lg font-medium">
                  {myScore > opponentScore ? "🎉 你的分身获胜！" : myScore < opponentScore ? "😢 你的分身落败" : "🤝 平局"}
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <Link href="/match" className="btn-primary">
                  继续匹配
                </Link>
                <Link href="/leaderboard" className="btn-secondary">
                  查看排行榜
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
