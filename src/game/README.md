# Chess Game Logic

This directory will contain chess game logic that can be shared between components.

## Usage with soundUtils

To use the new sound system in ChessGame.tsx:

```typescript
// At the top of ChessGame.tsx
import { playSound, SoundTypes } from '@/utils/soundUtils';

// ...existing code...

// When a piece is moved
playSound(SoundTypes.MOVE);

// When a piece is captured
playSound(SoundTypes.CAPTURE);

// When the king is in check
playSound(SoundTypes.CHECK);

// When an invalid move is attempted
playSound(SoundTypes.INVALID);
```

## Future Enhancements

- Move core game logic to this directory
- Create reusable hooks for game state management
- Add FEN notation parsing and generation
- Implement PGN export/import