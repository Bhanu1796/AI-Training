# Tic Tac Toe Agent — Architecture

## System Overview

```
Browser (React)
     │  POST /game/start | /game/move
     ▼
FastAPI Backend
     │
     ├── GameService ──► GameBoard (pure game logic + minimax)
     │
     └── TicTacToeAgent (LangGraph)
              │
              ▼
        Amzur LiteLLM Proxy
              │
              ▼
        Gemini 2.5 Flash
```

---

## Backend Architecture

### Directory Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, router include
│   ├── api/
│   │   └── game.py                # Thin route handlers → delegate to game_service
│   ├── services/
│   │   └── game_service.py        # All game business logic
│   ├── ai/
│   │   ├── llm.py                 # LiteLLM ChatOpenAI client (shared)
│   │   ├── agent/
│   │   │   └── tictactoe_agent.py # LangGraph agent: board → move index
│   │   └── prompts/
│   │       └── tictactoe.txt      # System prompt for the AI agent
│   ├── models/
│   │   └── game.py                # SQLAlchemy Game ORM model
│   ├── schemas/
│   │   └── game.py                # Pydantic: GameState, MoveRequest, MoveResponse
│   └── core/
│       └── config.py              # Settings from env vars
├── alembic/
│   └── versions/
│       └── 001_create_games.py
└── requirements.txt
```

---

### Layer Responsibilities

#### `api/game.py` — Router (thin)
- Parses request body using Pydantic schemas
- Calls `game_service` functions
- Returns typed `MoveResponse`
- No game logic, no direct DB access

#### `services/game_service.py` — Business Logic
- `start_game(player_symbol)` → creates `GameBoard`, persists to DB, returns `GameState`
- `apply_move(game_id, cell_index)` → validates move, updates board, checks win/draw, triggers agent
- `get_game(game_id)` → fetch game state from DB
- `reset_game(game_id)` → clear board, keep game record
- Calls `tictactoe_agent.decide_move()` or `minimax()` based on `AGENT_MODE`

#### `ai/agent/tictactoe_agent.py` — LangGraph Agent

LangGraph graph with a single `decide_move` node:

```
START → [decide_move node] → END
              │
              ▼
        Format board as ASCII
        Send to LLM with system prompt
        Parse integer 0–8 from response
        Validate: cell must be empty
        Fallback to minimax if invalid
```

**State schema:**
```python
class AgentState(TypedDict):
    board: list[str | None]   # 9-cell list: "X", "O", or None
    agent_symbol: str          # "X" or "O"
    move: int | None           # output: chosen cell index
    reasoning: str | None      # LLM explanation (optional)
```

#### `services/game_service.py` — `GameBoard` (pure logic)

```python
class GameBoard:
    board: list[str | None]   # index 0–8, row-major
    
    def apply_move(index, symbol) -> None
    def check_winner() -> str | None        # "X", "O", or None
    def is_draw() -> bool
    def available_moves() -> list[int]
    def minimax(is_maximizing, alpha, beta) -> int   # alpha-beta pruning
    def best_minimax_move(symbol) -> int
    def to_ascii() -> str                    # for LLM prompt
```

---

### Data Flow: Player Move

```
1. Frontend: POST /game/move { game_id, cell_index }
2. Router: validate schema, call game_service.apply_move()
3. GameService:
   a. Load game from DB
   b. Validate: game is PLAYER_TURN, cell is empty, index in 0–8
   c. Apply player move to board
   d. Check win/draw → if GAME_OVER, save and return
   e. If AGENT_MODE=llm: call tictactoe_agent.decide_move(board, agent_symbol)
      If AGENT_MODE=minimax: call board.best_minimax_move(agent_symbol)
      If AGENT_MODE=random: pick random available cell
   f. Apply agent move to board
   g. Check win/draw again
   h. Persist updated game to DB
4. Return MoveResponse { board, status, winner, agent_move, agent_reasoning }
5. Frontend: update board UI, highlight winner line if applicable
```

---

### Database Schema

#### `games` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `board` | JSON | 9-element list: `"X"`, `"O"`, or `null` |
| `player_symbol` | VARCHAR(1) | `"X"` or `"O"` |
| `agent_symbol` | VARCHAR(1) | Opposite of player |
| `status` | VARCHAR(20) | `"player_turn"` \| `"agent_thinking"` \| `"game_over"` |
| `winner` | VARCHAR(10) | `"player"` \| `"agent"` \| `"draw"` \| `null` |
| `move_history` | JSON | List of `{symbol, index, timestamp}` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### Pydantic Schemas

```python
# Request
class StartGameRequest(BaseModel):
    player_symbol: Literal["X", "O"] = "X"
    agent_mode: Literal["llm", "minimax", "random"] = "llm"

class MoveRequest(BaseModel):
    game_id: UUID
    cell_index: int = Field(..., ge=0, le=8)

# Response
class GameState(BaseModel):
    game_id: UUID
    board: list[str | None]        # 9 cells
    status: str                    # player_turn | game_over
    winner: str | None             # player | agent | draw | None
    player_symbol: str
    agent_symbol: str
    winning_line: list[int] | None # e.g. [0, 1, 2] for top row

class MoveResponse(BaseModel):
    game_state: GameState
    agent_move: int | None         # cell index agent played
    agent_reasoning: str | None    # LLM explanation if available
```

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── pages/
│   └── GamePage.tsx          # Root game page: layout, mode selectors
├── components/
│   ├── Board.tsx             # 3×3 grid, click handler, winning line highlight
│   ├── Cell.tsx              # Single cell: X / O / empty, disabled state
│   ├── GameStatus.tsx        # "Your turn", "Agent thinking…", "You won!", etc.
│   ├── AgentThinking.tsx     # Pulse overlay while waiting for agent response
│   ├── ScoreBoard.tsx        # Session win/loss/draw counter
│   └── ModeSelector.tsx      # Symbol picker (X/O) + difficulty selector
├── hooks/
│   └── useGame.ts            # All game state + API mutations
├── lib/
│   └── api.ts                # Axios instance + typed API functions
└── types/
    └── index.ts              # GameState, MoveResponse, etc.
```

---

### Component Tree

```
GamePage
├── ModeSelector          (symbol X/O, difficulty: LLM/Minimax/Random)
├── ScoreBoard            (wins / losses / draws)
├── GameStatus            (current turn message / result banner)
├── Board
│   └── Cell × 9         (X / O / empty; highlighted on win)
└── AgentThinking         (shown while waiting for POST /game/move response)
```

---

### `useGame.ts` Hook — State & Mutations

```typescript
interface UseGameReturn {
  gameState: GameState | null;
  isLoading: boolean;
  agentReasoning: string | null;
  score: { wins: number; losses: number; draws: number };
  startGame: (symbol: "X" | "O", mode: AgentMode) => void;
  makeMove: (cellIndex: number) => void;
  resetGame: () => void;
}
```

**Flow:**
1. `startGame()` → `POST /game/start` → sets `gameState`
2. `makeMove(index)` → disabled if `gameState.status !== "player_turn"` → `POST /game/move` → updates `gameState`, stores `agentReasoning`
3. On `game_over`: increment session `score`, show result, enable Reset

---

### Board Cell Indexing

```
 0 | 1 | 2
---+---+---
 3 | 4 | 5
---+---+---
 6 | 7 | 8
```

Winning lines: `[0,1,2]`, `[3,4,5]`, `[6,7,8]`, `[0,3,6]`, `[1,4,7]`, `[2,5,8]`, `[0,4,8]`, `[2,4,6]`

---

## AI Agent Design

### Mode: `llm` (default)

1. Format board as ASCII grid with cell indices shown for empty cells
2. Build prompt: system prompt from `tictactoe.txt` + user message with board
3. Call Gemini 2.5 Flash via LiteLLM proxy (`user="agent"`)
4. Expect response: a single integer `0`–`8`
5. Extract integer with regex; validate it is an available move
6. If invalid (occupied, out of range, unparseable) → fall back to minimax
7. Optionally request a second call for reasoning text (shown in UI sidebar)

### Mode: `minimax` (perfect play)

- Alpha-beta pruning, depth-limited by board size (max depth 9)
- Always plays optimally — cannot be beaten, only drawn
- Used as LLM fallback and as selectable difficulty

### Mode: `random`

- Picks uniformly at random from available moves
- Used for "Easy" difficulty

### LangGraph Graph Definition

```python
graph = StateGraph(AgentState)
graph.add_node("decide_move", decide_move_node)
graph.set_entry_point("decide_move")
graph.set_finish_point("decide_move")
agent = graph.compile()
```

---

## Security Considerations

- Cell index validated server-side: `0 <= index <= 8` and cell must be empty
- Game status checked before accepting move: reject if `status == "game_over"`
- No SQL injection risk: board stored as JSON blob, no raw query construction
- LLM output never executed as code — only parsed as integer
- Rate-limit `/game/move` if deployed publicly (1 req/sec per session)

---

## Configuration

```
LITELLM_PROXY_URL=https://litellm.amzur.com
LITELLM_API_KEY=sk-...
LLM_MODEL=gemini/gemini-2.5-flash
AGENT_MODE=llm                        # llm | minimax | random
DATABASE_URL=postgresql+asyncpg://...
FRONTEND_URL=http://localhost:5173
```
