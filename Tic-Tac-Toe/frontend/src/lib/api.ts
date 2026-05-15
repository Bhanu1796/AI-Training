import axios from 'axios'
import type {
  AgentMode,
  GameState,
  GameSummary,
  MoveResponse,
  PlayerSymbol,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const gameApi = {
  start: (player_symbol: PlayerSymbol, agent_mode: AgentMode): Promise<GameState> =>
    api.post<GameState>('/game/start', { player_symbol, agent_mode }).then((r) => r.data),

  move: (game_id: string, cell_index: number): Promise<MoveResponse> =>
    api.post<MoveResponse>('/game/move', { game_id, cell_index }).then((r) => r.data),

  get: (game_id: string): Promise<GameState> =>
    api.get<GameState>(`/game/${game_id}`).then((r) => r.data),

  reset: (game_id: string): Promise<GameState> =>
    api.post<GameState>(`/game/${game_id}/reset`).then((r) => r.data),

  history: (): Promise<GameSummary[]> =>
    api.get<GameSummary[]>('/game/history').then((r) => r.data),
}
