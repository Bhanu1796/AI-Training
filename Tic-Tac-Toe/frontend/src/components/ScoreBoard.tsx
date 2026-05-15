import type { Score } from '../types'

interface ScoreBoardProps {
  score: Score
}

export default function ScoreBoard({ score }: ScoreBoardProps) {
  return (
    <div className="flex gap-6 justify-center text-sm font-semibold">
      <div className="flex flex-col items-center gap-1">
        <span className="text-green-400 text-2xl">{score.wins}</span>
        <span className="text-gray-400">Wins</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-yellow-400 text-2xl">{score.draws}</span>
        <span className="text-gray-400">Draws</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-rose-400 text-2xl">{score.losses}</span>
        <span className="text-gray-400">Losses</span>
      </div>
    </div>
  )
}
