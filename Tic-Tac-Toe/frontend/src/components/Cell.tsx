interface CellProps {
  value: string | null
  index: number
  isWinning: boolean
  disabled: boolean
  onClick: (index: number) => void
}

export default function Cell({ value, index, isWinning, disabled, onClick }: CellProps) {
  const isEmpty = value === null

  const base =
    'flex items-center justify-center w-24 h-24 text-5xl font-bold rounded-xl border-2 transition-all duration-150 select-none'

  const stateClass = isWinning
    ? 'border-yellow-400 bg-yellow-400/10 scale-105'
    : isEmpty && !disabled
    ? 'border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-gray-400 cursor-pointer'
    : 'border-gray-700 bg-gray-800 cursor-not-allowed'

  const symbolClass =
    value === 'X'
      ? isWinning
        ? 'text-yellow-400'
        : 'text-blue-400'
      : value === 'O'
      ? isWinning
        ? 'text-yellow-400'
        : 'text-rose-400'
      : 'text-transparent'

  return (
    <button
      className={`${base} ${stateClass}`}
      onClick={() => isEmpty && !disabled && onClick(index)}
      disabled={disabled || !isEmpty}
      aria-label={value ?? `Cell ${index}`}
    >
      <span className={symbolClass}>{value ?? '·'}</span>
    </button>
  )
}
