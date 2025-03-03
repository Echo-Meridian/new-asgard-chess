# Chess AI Cross-Platform Implementation

## Overview

This module provides a cross-platform implementation for chess AI using Stockfish. The architecture is designed to work on both iOS and Android, with a clean interface between the game logic and the AI engine.

## File Structure

- **stockfish.ts**: Platform-agnostic interface
- **fen-converter.ts**: Board to FEN conversion utility
- **move-parser.ts**: UCI to Move conversion utility
- **/platform**
  - **stockfish-ios.ts**: iOS-specific implementation
  - **stockfish-android.ts**: Android-specific implementation

## Implementation Strategy

The implementation follows a clean architecture with:

1. **Platform Abstraction**: Common interface with platform-specific implementations
2. **Game Logic Separation**: AI logic separated from chess game logic
3. **Mobile Optimization**: Configured for performance and battery life
4. **Simplified API**: Clean, consistent API for the game components

## Interface Design

```typescript
interface StockfishEngine {
  init(): Promise<boolean>;
  setPosition(fen: string): Promise<void>;
  getBestMove(config: StockfishConfig): Promise<string>;
  analyzePosition(config: StockfishConfig): Promise<MoveAnalysis>;
  setSkillLevel(elo: number): Promise<void>;
  dispose(): void;
}
```

## Mobile Optimizations

- Memory usage: 16MB hash table
- Threading: 1-2 threads maximum
- Controlled search depth
- No background analysis (pondering)
- Clean resource management

## Implementation Notes

All files use TypeScript with consistent error handling and clean async patterns. The implementation includes a JavaScript fallback for immediate testing while native implementations are developed.
