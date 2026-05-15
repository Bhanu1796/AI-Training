import { useState } from 'react'
import type { AgentMode, PlayerSymbol } from '../types'
import { useGame } from '../hooks/useGame'
import Board from '../components/Board'
import GameStatus from '../components/GameStatus'
import AgentThinking from '../components/AgentThinking'
import ScoreBoard from '../components/ScoreBoard'
import ModeSelector from '../components/ModeSelector'

export default function GamePage() {
  const [selectedSymbol, setSelectedSymbol] = useState<PlayerSymbol>('X')
  const [selectedMode, setSelectedMode] = useState<AgentMode>('llm')

  const { gameState, agentReasoning, score, error, isLoading, makeMove, newGame, resetGame } =
    useGame()

  const isBoardDisabled =
    !gameState || gameState.status !== 'player_turn' || isLoading

  const isGameOver = gameState?.status === 'game_over'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">Tic Tac Toe</h1>
        <p className="text-gray-400 text-sm mt-1">Play against an AI agent</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 items-start justify-center w-full max-w-3xl">
        {/* Left panel — settings */}
        <div className="w-full lg:w-56 shrink-0">
          <ModeSelector
            symbol={selectedSymbol}
            mode={selectedMode}
            disabled={isLoading}
            onSymbolChange={setSelectedSymbol}
            onModeChange={setSelectedMode}
            onNewGame={() => newGame(selectedSymbol, selectedMode)}
          />
        </div>

        {/* Right panel — game */}
        <div className="flex flex-col items-center gap-6 flex-1">
          {/* Score */}
          <ScoreBoard score={score} />

          {/* Status */}
          <GameStatus
            gameState={gameState}
            isLoading={isLoading}
            playerSymbol={selectedSymbol}
          />

          {/* Agent thinking indicator */}
          {(isLoading || gameState?.status === 'agent_thinking') && gameState && <AgentThinking />}

          {/* Board */}
          <Board
            board={gameState?.board ?? Array(9).fill(null)}
            winningLine={gameState?.winning_line ?? null}
            disabled={isBoardDisabled}
            onCellClick={makeMove}
          />

          {/* Post-game actions */}
          {isGameOver && (
            <div className="flex gap-3">
              <button
                onClick={resetGame}
                className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-all"
              >
                Play Again (same settings)
              </button>
              <button
                onClick={() => newGame(selectedSymbol, selectedMode)}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
              >
                New Game
              </button>
            </div>
          )}

          {/* Agent reasoning */}
          {agentReasoning && (
            <div className="max-w-sm w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-300">
              <p className="text-xs text-indigo-400 uppercase tracking-widest mb-1">
                Agent reasoning
              </p>
              <p>{agentReasoning}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-rose-400 text-sm bg-rose-400/10 border border-rose-400/30 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
