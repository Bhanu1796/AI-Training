"""
Pure game logic: board state, win/draw detection, minimax with alpha-beta pruning.
No framework dependencies — unit-testable in isolation.
"""
import math

WINNING_LINES: list[list[int]] = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],  # rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],  # columns
    [0, 4, 8], [2, 4, 6],             # diagonals
]


class GameBoard:
    def __init__(self, board: list[str | None] | None = None) -> None:
        self.board: list[str | None] = board[:] if board else [None] * 9

    # ------------------------------------------------------------------
    # Move application
    # ------------------------------------------------------------------

    def apply_move(self, index: int, symbol: str) -> None:
        if not (0 <= index <= 8):
            raise ValueError(f"Cell index {index} is out of range (0–8)")
        if self.board[index] is not None:
            raise ValueError(f"Cell {index} is already occupied by '{self.board[index]}'")
        self.board[index] = symbol

    # ------------------------------------------------------------------
    # Win / draw detection
    # ------------------------------------------------------------------

    def check_winner(self) -> str | None:
        for line in WINNING_LINES:
            a, b, c = line
            if self.board[a] and self.board[a] == self.board[b] == self.board[c]:
                return self.board[a]
        return None

    def check_winner_with_line(self) -> tuple[str | None, list[int] | None]:
        for line in WINNING_LINES:
            a, b, c = line
            if self.board[a] and self.board[a] == self.board[b] == self.board[c]:
                return self.board[a], line
        return None, None

    def is_draw(self) -> bool:
        return all(c is not None for c in self.board) and self.check_winner() is None

    def available_moves(self) -> list[int]:
        return [i for i, cell in enumerate(self.board) if cell is None]

    def is_terminal(self) -> bool:
        return self.check_winner() is not None or self.is_draw()

    # ------------------------------------------------------------------
    # ASCII representation (for LLM prompt)
    # ------------------------------------------------------------------

    def to_ascii(self) -> str:
        def cell(i: int) -> str:
            return self.board[i] if self.board[i] is not None else str(i)

        return (
            f" {cell(0)} | {cell(1)} | {cell(2)} \n"
            "---+---+---\n"
            f" {cell(3)} | {cell(4)} | {cell(5)} \n"
            "---+---+---\n"
            f" {cell(6)} | {cell(7)} | {cell(8)} "
        )

    # ------------------------------------------------------------------
    # Minimax with alpha-beta pruning
    # ------------------------------------------------------------------

    def _minimax(
        self,
        is_maximizing: bool,
        max_symbol: str,
        min_symbol: str,
        alpha: float,
        beta: float,
    ) -> int:
        winner = self.check_winner()
        if winner == max_symbol:
            return 10
        if winner == min_symbol:
            return -10
        moves = self.available_moves()
        if not moves:
            return 0

        if is_maximizing:
            best = -math.inf
            for move in moves:
                self.board[move] = max_symbol
                score = self._minimax(False, max_symbol, min_symbol, alpha, beta)
                self.board[move] = None
                best = max(best, score)
                alpha = max(alpha, best)
                if beta <= alpha:
                    break
            return int(best)
        else:
            best = math.inf
            for move in moves:
                self.board[move] = min_symbol
                score = self._minimax(True, max_symbol, min_symbol, alpha, beta)
                self.board[move] = None
                best = min(best, score)
                beta = min(beta, best)
                if beta <= alpha:
                    break
            return int(best)

    def best_minimax_move(self, agent_symbol: str) -> int:
        player_symbol = "O" if agent_symbol == "X" else "X"
        best_score = -math.inf
        best_move = self.available_moves()[0]
        for move in self.available_moves():
            self.board[move] = agent_symbol
            score = self._minimax(False, agent_symbol, player_symbol, -math.inf, math.inf)
            self.board[move] = None
            if score > best_score:
                best_score = score
                best_move = move
        return best_move
