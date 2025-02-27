# New Asgard Chess

A Norse-themed chess game with Stockfish AI integration.

## Features

- Standard chess rules with visual indicators
- Norse rune overlays for move visualization
- Sound effects for moves, captures, and check
- AI opponent using Stockfish chess engine
- Mobile-friendly responsive design
- Progressive Web App (PWA) support

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Prepare the AI dependencies:

```bash
npm run prepare-ai
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## AI Integration

This project uses a mock Stockfish implementation for development and testing. For production use, you should replace the mock files with the actual Stockfish WASM files.

The mock Stockfish engine:
- Understands and responds to UCI protocol commands
- Generates plausible chess moves based on common openings
- Simulates analysis with varying depths and scores

## Project Structure

- `/src/ai` - Stockfish chess AI integration
- `/src/components` - React UI components
- `/src/hooks` - Custom React hooks
- `/src/types` - TypeScript definitions
- `/src/utils` - Utility functions
- `/public/stockfish` - Stockfish engine files

## Technologies

- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Stockfish](https://stockfishchess.org/)

## Recent Improvements

- Fixed favicon issues on iOS devices
- Added robust sound system with mobile support
- Implemented Stockfish chess AI integration
- Created AI controls with difficulty settings