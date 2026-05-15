import type { GameState } from '../types'

interface GameStatusProps {
  gameState: GameState | null
  isLoading: boolean
  playerSymbol: string
}

export default function GameStatus({ gameState, isLoading, playerSymbol }: GameStatusProps) {
  if (!gameState) {
    return (
      <div className="text-center text-gray-400 text-lg">
        Choose your settings and press <span className="text-white font-semibold">New Game</span>.
      </div>
    )
  }

  if (gameState.status === 'agent_thinking' || isLoading) {
    return (
      <div className="text-center text-indigo-400 text-lg animate-pulse">
        Agent is thinking…
      </div>
    )
  }

  if (gameState.status === 'game_over') {
    const winner = gameState.winner
    if (winner === 'player') {
      return (
        <div className="text-center text-green-400 text-2xl font-bold animate-bounce">
          You won! 🎉
        </div>
      )
    }
    if (winner === 'agent') {
      return (
        <div className="text-center text-rose-400 text-2xl font-bold">
          Agent wins! Better luck next time.
        </div>
      )
    }
    return (
      <div className="text-center text-yellow-400 text-2xl font-bold">
        It's a draw!
      </div>
    )
  }

  return (
    <div className="text-center text-gray-300 text-lg">
      Your turn — you are{' '}
      <span className={playerSymbol === 'X' ? 'text-blue-400 font-bold' : 'text-rose-400 font-bold'}>
        {playerSymbol}
      </span>
    </div>
  )
}
