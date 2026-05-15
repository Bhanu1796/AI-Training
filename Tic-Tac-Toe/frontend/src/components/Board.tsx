import Cell from './Cell'

interface BoardProps {
  board: (string | null)[]
  winningLine: number[] | null
  disabled: boolean
  onCellClick: (index: number) => void
}

export default function Board({ board, winningLine, disabled, onCellClick }: BoardProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {board.map((value, i) => (
        <Cell
          key={i}
          index={i}
          value={value}
          isWinning={winningLine?.includes(i) ?? false}
          disabled={disabled}
          onClick={onCellClick}
        />
      ))}
    </div>
  )
}
