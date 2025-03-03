# Chess AI Implementation Instructions for Claude Code

## Project Overview
Implement a cross-platform AI integration for a chess game using Stockfish. The implementation needs to provide a clean interface between the game logic and the AI engine, with optimizations for mobile performance.

## Core Requirements
1. Platform-agnostic interface with platform-specific implementations for iOS and Android
2. Clean separation between chess game logic and AI logic
3. Mobile-optimized for performance and battery usage
4. Simple, reliable API for the game components to use

## File Structure to Create

```
/src
  /ai
    stockfish.ts         # Platform-agnostic interface
    fen-converter.ts     # Board to FEN conversion utility
    move-parser.ts       # UCI to Move conversion utility
    /platform
      stockfish-ios.ts   # iOS-specific implementation
      stockfish-android.ts # Android-specific implementation
  /hooks
    useChessAI.ts        # React hook for the game components
```

## Detailed Instructions

### 1. Create Platform-Agnostic Interface
Implement `stockfish.ts` with:
- Platform detection to select the right implementation
- Common interfaces and configuration types
- Simple factory function to create the right instance

### 2. Create Board State Conversion
Implement `fen-converter.ts` with:
- Function to convert a chess board to FEN notation
- Handle special cases (castling rights, en passant)
- Provide utility functions for FEN manipulation

### 3. Create Move Parsing Utilities
Implement `move-parser.ts` with:
- Functions to convert between UCI notation and Move objects
- Validation for UCI strings and moves
- Utility functions for working with chess moves

### 4. Create Platform-Specific Implementations
Implement both:
- `stockfish-ios.ts`: Using native module pattern for iOS
- `stockfish-android.ts`: Using native module pattern for Android
Both should implement the same interface with platform-specific details.

### 5. Create React Hook
Implement `useChessAI.ts` with:
- State management for initialization, loading, errors
- Methods for getting moves, hints, analyzing positions
- Clean error handling and recovery

## Technical Requirements

### Interface Design
The `Stockfish` interface should include:
```typescript
interface StockfishEngine {
  init(): Promise<boolean>;
  setPosition(fen: string): Promise<void>;
  getBestMove(config: StockfishConfig): Promise<string>;
  analyzePosition(config: StockfishConfig): Promise<MoveAnalysis>;
  setSkillLevel(elo: number): Promise<void>;
  dispose(): void;
}

interface StockfishConfig {
  depth?: number;   // Search depth
  time?: number;    // Time in milliseconds
  elo?: number;     // Target ELO rating
}

interface MoveAnalysis {
  move: string;     // Best move in UCI format
  score: number;    // Centipawn score
  depth: number;    // Search depth reached
}
```

### FEN Conversion
Board conversion should handle:
- Piece positions
- Active color
- Castling availability
- En passant target square
- Halfmove clock
- Fullmove number

### Move Parsing
Move parsing should handle:
- Basic UCI format (e.g., "e2e4")
- Promotion (e.g., "e7e8q")
- Special moves (castling, en passant)

### React Hook API
The hook should expose:
```typescript
function useChessAI() {
  return {
    initialized: boolean,
    loading: boolean,
    error: string | null,
    difficulty: DifficultyLevel,
    setDifficulty: (level: DifficultyLevel) => Promise<void>,
    getAIMove: (board, player, ...) => Promise<Move | null>,
    getHint: (board, player) => Promise<Position | null>,
    analyzePosition: (board, player) => Promise<Analysis>,
    init: () => Promise<boolean>
  };
}
```

## Mobile Optimizations
Include these optimizations in the implementation:
- Limit hash memory to 16MB
- Use 1-2 threads maximum
- Set appropriate search depths based on difficulty
- No pondering (analyzing on opponent's time)
- Clean resource management (proper cleanup)

## Implementation Notes
1. Use TypeScript for all files
2. Provide detailed comments for complex logic
3. Include error handling for all asynchronous operations
4. Handle initialization and cleanup properly

## Temporary Fallback
Create a JavaScript-based engine as a temporary solution that provides basic moves while the native implementations are developed:
- Simple implementation that returns valid moves
- Should follow the same interface as the native versions
- Can be used on both platforms

This will allow testing the integration immediately while the full native solutions are completed.
