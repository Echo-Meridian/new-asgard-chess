# Stockfish Integration Plan

## Step 1: Setup WASM Files
- Download Stockfish WASM files from https://github.com/lichess-org/stockfish.wasm/releases/
- Place in `/public/stockfish/` directory
  - stockfish.wasm
  - stockfish.js
  - stockfish.worker.js

## Step 2: Create Core Integration Files
1. `stockfish.ts` - Basic interface to Stockfish
```typescript
export interface StockfishConfig {
  depth?: number;
  time?: number;
  elo?: number; 
}

export class StockfishEngine {
  // Initialize engine
  init(): Promise<void>;
  
  // Set position from FEN or moves
  setPosition(fen: string): void;
  
  // Get best move
  getBestMove(config: StockfishConfig): Promise<string>;
  
  // Analyze position
  analyzePosition(config: StockfishConfig): Promise<any>;
  
  // Set skill level (ELO)
  setSkillLevel(elo: number): void;
}
```

2. `fen.ts` - FEN notation utilities
```typescript
// Convert board to FEN
export function boardToFEN(board: any[][], currentPlayer: string): string;

// Convert FEN to board
export function FENToBoard(fen: string): { board: any[][], currentPlayer: string };
```

## Step 3: UI Integration in ChessGame.tsx
- Add AI opponent toggle
- Add difficulty selector 
- Add "hint" button for move suggestions
- Create AI player state in component

## Step 4: Game Flow with AI
```typescript
// In handleSquareClick or similar function
async function afterPlayerMove() {
  if (playingAgainstAI && currentPlayer === 'black') {
    // Show loading indicator
    setIsAIThinking(true);
    
    try {
      // Get AI move
      const fen = boardToFEN(board, currentPlayer);
      await engine.setPosition(fen);
      const bestMove = await engine.getBestMove({ depth: difficultyDepth });
      
      // Execute AI move
      const { from, to } = parseMove(bestMove);
      executeMove(from, to);
      
    } finally {
      setIsAIThinking(false);
    }
  }
}
```

## Implementation Timeline
1. Basic Stockfish loading and initialization - 2 hours
2. FEN conversion and board representation - 3 hours
3. Move generation and execution - 2 hours  
4. UI integration and difficulty levels - 3 hours
5. Testing and refinement - 2 hours

Total estimate: ~12 hours of development time