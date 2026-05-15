import type { AgentMode, PlayerSymbol } from '../types'

interface ModeSelectorProps {
  symbol: PlayerSymbol
  mode: AgentMode
  disabled: boolean
  onSymbolChange: (s: PlayerSymbol) => void
  onModeChange: (m: AgentMode) => void
  onNewGame: () => void
}

const MODES: { value: AgentMode; label: string; description: string }[] = [
  { value: 'llm', label: 'AI Agent', description: 'Gemini 2.5 Flash' },
  { value: 'minimax', label: 'Perfect', description: 'Minimax — unbeatable' },
  { value: 'random', label: 'Easy', description: 'Random moves' },
]

export default function ModeSelector({
  symbol,
  mode,
  disabled,
  onSymbolChange,
  onModeChange,
  onNewGame,
}: ModeSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Symbol selector */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Play as</p>
        <div className="flex gap-3">
          {(['X', 'O'] as PlayerSymbol[]).map((s) => (
            <button
              key={s}
              onClick={() => !disabled && onSymbolChange(s)}
              disabled={disabled}
              className={`w-14 h-14 rounded-xl text-2xl font-bold border-2 transition-all
                ${
                  symbol === s
                    ? s === 'X'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-rose-500 bg-rose-500/20 text-rose-400'
                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-400'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty selector */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Difficulty</p>
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => !disabled && onModeChange(m.value)}
              disabled={disabled}
              className={`flex flex-col items-start px-4 py-2 rounded-lg border transition-all text-left
                ${
                  mode === m.value
                    ? 'border-indigo-500 bg-indigo-500/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-sm font-semibold text-white">{m.label}</span>
              <span className="text-xs text-gray-400">{m.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* New Game button */}
      <button
        onClick={onNewGame}
        className="mt-2 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all active:scale-95"
      >
        New Game
      </button>
    </div>
  )
}
