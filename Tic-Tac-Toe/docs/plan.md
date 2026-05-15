# Project 11 — Tic Tac Toe Agent: Implementation Plan

## Overview

Build a full-stack Tic Tac Toe web application where users play against an AI agent powered by Gemini 2.5 Flash via the Amzur LiteLLM proxy. The agent reasons about board state and selects the optimal move. A minimax algorithm serves as a deterministic fallback.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, TanStack Query |
| **Backend** | FastAPI, Python 3.11+ |
| **AI Agent** | LangGraph + Gemini 2.5 Flash via Amzur LiteLLM Proxy |
| **Fallback** | Minimax algorithm (perfect play, no AI call needed) |
| **Database** | PostgreSQL (SQLAlchemy 2.0, Alembic) — optional: game history |
| **Auth** | Optional — JWT session to track player stats |

---

## Phases

### Phase 1 — Project Scaffold
- [ ] Create `Tic-Tac-Toe/backend/` and `Tic-Tac-Toe/frontend/` directories
- [ ] Set up FastAPI app with CORS and health endpoint
- [ ] Set up React + Vite + TypeScript + Tailwind CSS
- [ ] Configure `.env` for LiteLLM proxy settings
- [ ] Add `requirements.txt` and `package.json`

### Phase 2 — Core Game Logic (Backend)
- [ ] Implement `GameBoard` class: board state, move validation, win/draw detection
- [ ] Implement minimax algorithm with alpha-beta pruning for perfect play
- [ ] Define SQLAlchemy `Game` model (board state, current player, status, winner)
- [ ] Define Pydantic schemas: `GameState`, `MoveRequest`, `MoveResponse`
- [ ] Create `game_service.py`: start game, apply move, check status, reset
- [ ] Create `POST /game/start` — initialise a new game, return game ID + board
- [ ] Create `POST /game/move` — accept player move, return updated board + agent move
- [ ] Create `GET /game/{game_id}` — fetch current game state
- [ ] Create `POST /game/reset` — reset board, keep game ID

### Phase 3 — AI Agent
- [ ] Build `tictactoe_agent.py` using LangGraph with a single `decide_move` node
- [ ] System prompt: instruct agent to analyse board and return a valid cell index (0–8)
- [ ] Parse and validate agent output; fall back to minimax if output is invalid or occupied
- [ ] Route all LLM calls through LiteLLM proxy with `user` field set to `"agent"`
- [ ] Add configurable `AGENT_MODE` env var: `"llm"` | `"minimax"`

### Phase 4 — Frontend UI
- [ ] `GamePage.tsx` — full-page game layout
- [ ] `Board.tsx` — 3×3 grid, clickable cells, highlight winning line
- [ ] `Cell.tsx` — render X, O, or empty; disabled state when not player's turn
- [ ] `GameStatus.tsx` — display current turn, winner, draw message
- [ ] `AgentThinking.tsx` — spinner/overlay while agent is computing
- [ ] `ScoreBoard.tsx` — win/loss/draw counts for the session
- [ ] `useGame.ts` hook — manages game state, API calls via TanStack Query mutations
- [ ] Mode selector: play as X (first) or O (second)
- [ ] Difficulty selector: LLM Agent | Perfect (minimax) | Easy (random)

### Phase 5 — Game History (Optional)
- [ ] `Game` model with Alembic migration
- [ ] Store game result, move sequence, timestamps
- [ ] `GET /game/history` — return list of past games
- [ ] `HistoryPage.tsx` — render past game boards with move replay

### Phase 6 — Polish & Testing
- [ ] Unit tests: win detection, draw detection, minimax correctness
- [ ] Integration tests: `/game/start`, `/game/move` endpoints
- [ ] Frontend: loading states, error handling, responsive layout
- [ ] Add agent "thinking" commentary (LLM explains its move in a sidebar)

---

## API Endpoints Summary

| Method | Path | Description |
|---|---|---|
| `POST` | `/game/start` | Start a new game, choose player symbol |
| `POST` | `/game/move` | Submit player move → get agent response |
| `GET` | `/game/{game_id}` | Get current game state |
| `POST` | `/game/reset` | Reset the board |
| `GET` | `/game/history` | List past completed games |

---

## Game State Machine

```
IDLE → PLAYER_TURN → AGENT_THINKING → PLAYER_TURN → ... → GAME_OVER
                                                          ↘ (win / loss / draw)
```

---

## Environment Variables

```
# Amzur LiteLLM Proxy
LITELLM_PROXY_URL=https://litellm.amzur.com
LITELLM_API_KEY=sk-...
LLM_MODEL=gemini/gemini-2.5-flash

# Agent behaviour
AGENT_MODE=llm          # "llm" | "minimax" | "random"

# App
DATABASE_URL=postgresql+asyncpg://...
FRONTEND_URL=http://localhost:5173
```

---

## Folder Structure

```
Tic-Tac-Toe/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── game.py
│   │   ├── services/
│   │   │   └── game_service.py
│   │   ├── ai/
│   │   │   ├── llm.py
│   │   │   ├── agent/
│   │   │   │   └── tictactoe_agent.py
│   │   │   └── prompts/
│   │   │       └── tictactoe.txt
│   │   ├── models/
│   │   │   └── game.py
│   │   ├── schemas/
│   │   │   └── game.py
│   │   └── core/
│   │       └── config.py
│   ├── alembic/
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── GamePage.tsx
│   │   ├── components/
│   │   │   ├── Board.tsx
│   │   │   ├── Cell.tsx
│   │   │   ├── GameStatus.tsx
│   │   │   ├── AgentThinking.tsx
│   │   │   └── ScoreBoard.tsx
│   │   ├── hooks/
│   │   │   └── useGame.ts
│   │   ├── lib/
│   │   │   └── api.ts
│   │   └── types/
│   │       └── index.ts
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── docs/
    ├── plan.md
    ├── architecture.md
    └── prompt.md
```
