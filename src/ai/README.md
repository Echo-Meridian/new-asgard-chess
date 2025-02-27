# Chess AI Integration 

This directory will contain the Stockfish chess engine integration. 

## Planned Implementation

1. Download the Stockfish WASM binary from https://github.com/lichess-org/stockfish.wasm/releases/ and place it in `/public/stockfish/`

2. Create the following files:
   - `stockfish.ts` - Main interface to the engine
   - `engine.ts` - Manages communication with Stockfish
   - `analysis.ts` - Functions for analyzing positions
   - `moveGeneration.ts` - Functions for generating AI moves

3. Implement difficulty levels:
   - Easy (Elo ~1000)
   - Medium (Elo ~1500)
   - Hard (Elo ~2000)
   - Master (Elo ~2500)

## Usage

The AI will be integrated into ChessGame.tsx with options for:
- Playing against AI
- Getting move hints
- Position analysis
- Setting difficulty

## Resources

- Stockfish.js docs: https://github.com/lichess-org/stockfish.wasm
- WASM vs JS performance: https://lichess.org/blog/XlRW5RIAAB8AUJJ-/stockfish-11-wasm-port