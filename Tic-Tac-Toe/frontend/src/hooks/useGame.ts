import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { gameApi } from '../lib/api'
import type { AgentMode, GameState, PlayerSymbol, Score } from '../types'

export function useGame() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [agentReasoning, setAgentReasoning] = useState<string | null>(null)
  const [score, setScore] = useState<Score>({ wins: 0, losses: 0, draws: 0 })
  const [error, setError] = useState<string | null>(null)

  // ---- Start game --------------------------------------------------------
  const startMutation = useMutation({
    mutationFn: ({ symbol, mode }: { symbol: PlayerSymbol; mode: AgentMode }) =>
      gameApi.start(symbol, mode),
    onSuccess: (data) => {
      setGameState(data)
      setAgentReasoning(null)
      setError(null)
    },
    onError: () => setError('Failed to start game. Is the backend running?'),
  })

  // ---- Make move ---------------------------------------------------------
  const moveMutation = useMutation({
    mutationFn: ({ gameId, cellIndex }: { gameId: string; cellIndex: number }) =>
      gameApi.move(gameId, cellIndex),
    onMutate: ({ cellIndex }) => {
      // Optimistic update: show the player's symbol immediately and switch to
      // "agent_thinking" so the AgentThinking indicator appears right away.
      setGameState((prev) => {
        if (!prev) return prev
        const newBoard = [...prev.board]
        newBoard[cellIndex] = prev.player_symbol
        return { ...prev, board: newBoard, status: 'agent_thinking' }
      })
      setAgentReasoning(null)
    },
    onSuccess: (data) => {
      setGameState(data.game_state)
      setAgentReasoning(data.agent_reasoning)
      setError(null)
      if (data.game_state.status === 'game_over') {
        const w = data.game_state.winner
        setScore((prev) => ({
          wins: prev.wins + (w === 'player' ? 1 : 0),
          losses: prev.losses + (w === 'agent' ? 1 : 0),
          draws: prev.draws + (w === 'draw' ? 1 : 0),
        }))
      }
    },
    onError: (_err, { cellIndex }) => {
      // Roll back the optimistic update on failure
      setGameState((prev) => {
        if (!prev) return prev
        const newBoard = [...prev.board]
        newBoard[cellIndex] = null
        return { ...prev, board: newBoard, status: 'player_turn' }
      })
      setError('Move failed. Please try again.')
    },
  })

  // ---- Reset game --------------------------------------------------------
  const resetMutation = useMutation({
    mutationFn: (gameId: string) => gameApi.reset(gameId),
    onSuccess: (data) => {
      setGameState(data)
      setAgentReasoning(null)
      setError(null)
    },
    onError: () => setError('Reset failed.'),
  })

  // ---- Public API --------------------------------------------------------
  const startGame = useCallback(
    (symbol: PlayerSymbol, mode: AgentMode) => startMutation.mutate({ symbol, mode }),
    [startMutation],
  )

  const makeMove = useCallback(
    (cellIndex: number) => {
      if (!gameState) return
      if (gameState.status !== 'player_turn') return
      moveMutation.mutate({ gameId: gameState.game_id, cellIndex })
    },
    [gameState, moveMutation],
  )

  const resetGame = useCallback(() => {
    if (!gameState) return
    resetMutation.mutate(gameState.game_id)
  }, [gameState, resetMutation])

  const newGame = useCallback(
    (symbol: PlayerSymbol, mode: AgentMode) => {
      setGameState(null)
      setAgentReasoning(null)
      setError(null)
      startMutation.mutate({ symbol, mode })
    },
    [startMutation],
  )

  const isLoading =
    startMutation.isPending || moveMutation.isPending || resetMutation.isPending

  return {
    gameState,
    agentReasoning,
    score,
    error,
    isLoading,
    startGame,
    makeMove,
    resetGame,
    newGame,
  }
}
