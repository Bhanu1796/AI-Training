export type PlayerSymbol = 'X' | 'O'
export type AgentMode = 'llm' | 'minimax' | 'random'
export type GameStatus = 'player_turn' | 'agent_thinking' | 'game_over'
export type Winner = 'player' | 'agent' | 'draw' | null

export interface GameState {
  game_id: string
  board: (string | null)[]
  status: GameStatus
  winner: Winner
  player_symbol: PlayerSymbol
  agent_symbol: PlayerSymbol
  agent_mode: AgentMode
  winning_line: number[] | null
}

export interface MoveResponse {
  game_state: GameState
  agent_move: number | null
  agent_reasoning: string | null
}

export interface StartGameRequest {
  player_symbol: PlayerSymbol
  agent_mode: AgentMode
}

export interface MoveRequest {
  game_id: string
  cell_index: number
}

export interface GameSummary {
  game_id: string
  player_symbol: PlayerSymbol
  agent_symbol: PlayerSymbol
  agent_mode: AgentMode
  status: GameStatus
  winner: Winner
  created_at: string
}

export interface Score {
  wins: number
  losses: number
  draws: number
}
