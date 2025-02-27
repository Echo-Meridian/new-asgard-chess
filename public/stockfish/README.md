# Stockfish WASM Files

This directory contains files necessary for the Stockfish chess engine integration in New Asgard Chess.

## Mock Implementation

The files in this directory are mock implementations for development and testing:

- `stockfish.js` - A simplified mock implementation that simulates the Stockfish UCI protocol
- `stockfish.wasm` - A placeholder for the WebAssembly binary
- `stockfish.worker.js` - A placeholder for the Worker script

## Production Setup

For production use, you should replace these files with actual Stockfish WASM files from:
https://github.com/lichess-org/stockfish.wasm/releases

You can download them using the provided script:

```bash
npm run download-stockfish
```

Once the correct repository URL is determined. The current script attempts to download from:
`https://github.com/lichess-org/stockfish.wasm/releases/download/sf-nnue-0.22.1/`

## Notes on Implementation

The current mock implementation:

1. Simulates basic UCI protocol responses
2. Returns random moves from a predefined set of common opening moves
3. Simulates analysis with fake evaluation scores

This provides enough functionality to test the chess AI integration without requiring the actual Stockfish engine.