# New Asgard Chess - Development Guidelines

## Version
Current Version: 2.0.0 (Updated from 0.1.1)

## Game State
- Complete chess rules implementation (castling, en passant, promotion)
- Advanced draw detection (stalemate, threefold repetition, 50-move rule)
- Stockfish AI integration with multiple difficulty levels
- Norse-themed UI with rune overlays for visualizing moves
- Sound effects for moves, captures, and check
- Mobile-friendly responsive design with PWA support

## Current Status & Projects
- Fixed favicon paths in layout.tsx for better iOS support
- Created soundUtils.ts with improved sound handling for mobile devices
- Implemented Stockfish chess AI integration in src/ai directory
- Created React hook useChessAI for easy integration

## AI Integration Setup
To set up the Stockfish AI engine:
```bash
# Download Stockfish WASM files
npm run download-stockfish

# Or use the convenience script
npm run prepare-ai
```

## Build & Development Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run download-stockfish` - Download Stockfish WASM files
- `npm run prepare-ai` - Prepare AI integration

## Troubleshooting
- iOS audio issues: Audio requires user interaction; soundUtils.ts handles this
- PWA metadata: Check manifest.json and icons match layout.tsx references
- AI not working: Check that Stockfish files are properly downloaded to public/stockfish/

## Code Style Guidelines
- TypeScript with strict typing
- React functional components with hooks
- Component organization:
  - Types at top
  - Helper functions 
  - Main component with state
  - JSX at bottom
- Prefer utilities in separate files (e.g., soundUtils.ts)

## Project Structure
- `/src/ai` - Stockfish chess AI integration
- `/src/components` - Reusable UI components
- `/src/hooks` - Custom React hooks, including useChessAI
- `/src/types` - TypeScript type definitions
- `/src/utils` - Utility functions
- `/public/stockfish` - Stockfish WASM files (after download)