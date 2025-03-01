/**
 * Sound utilities for chess game
 */

// Sound types supported by the game
export type SoundType = 'move' | 'capture' | 'check' | 'invalid' | 'piece';

// Basic piece types and colors
type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
type PieceColor = 'white' | 'black';

// Piece info for piece-specific sounds
export interface PieceSoundInfo {
  type: PieceType;
  color: PieceColor;
}

// Type-safe sound paths
const SOUND_PATHS = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  invalid: '/sounds/invalid.mp3',
  
  // Piece-specific sounds
  pieces: {
    black: {
      pawn: '/sounds/pieces/black/pawn.MP3',
      rook: '/sounds/pieces/black/rook.mp3',
      knight: '/sounds/pieces/black/knight.mp3',
      bishop: '/sounds/pieces/black/bishop.mp3',
      queen: '/sounds/pieces/black/queen.mp3',
      king: '/sounds/pieces/black/king.mp3'
    },
    white: {
      pawn: '/sounds/pieces/white/pawn.MP3',
      rook: '/sounds/pieces/white/rook.mp3',
      knight: '/sounds/pieces/white/knight.mp3',
      bishop: '/sounds/pieces/white/bishop.mp3',
      queen: '/sounds/pieces/white/queen.mp3',
      king: '/sounds/pieces/white/king.mp3'
    }
  }
} as const;

// Cache audio elements to improve performance
const audioCache: Record<string, HTMLAudioElement> = {};

// Track if audio context has been unlocked on mobile
let audioUnlocked = false;

/**
 * Initialize audio context for mobile devices
 * Call this function on first user interaction
 */
export function initAudio(): void {
  if (typeof window === 'undefined' || audioUnlocked) return;
  
  // Create and play a silent audio to unlock audio on iOS
  const silentAudio = new Audio();
  silentAudio.volume = 0;
  silentAudio.play().then(() => {
    audioUnlocked = true;
  }).catch(e => {
    console.log('Audio permission still restricted:', e);
  });
  
  // Remove the click/touch listeners now that we've tried to unlock audio
  window.removeEventListener('click', initAudio);
  window.removeEventListener('touchend', initAudio);
}

// Add event listeners for first interaction
if (typeof window !== 'undefined') {
  window.addEventListener('click', initAudio);
  window.addEventListener('touchend', initAudio);
}

/**
 * Get or create an audio element from cache
 */
function getAudio(path: string): HTMLAudioElement {
  if (!audioCache[path]) {
    audioCache[path] = new Audio(path);
    audioCache[path].volume = 0.5;
  }
  return audioCache[path];
}

/**
 * Play a sound effect with robust error handling for mobile devices
 */
export function playSound(type: SoundType, pieceInfo?: PieceSoundInfo): void {
  if (typeof window === 'undefined') return;

  try {
    let soundPath = '';
    
    // Type-safe sound path selection
    switch (type) {
      case 'piece':
        if (pieceInfo && pieceInfo.color && pieceInfo.type) {
          soundPath = SOUND_PATHS.pieces[pieceInfo.color][pieceInfo.type];
        }
        break;
      case 'move':
        soundPath = SOUND_PATHS.move;
        break;
      case 'capture':
        soundPath = SOUND_PATHS.capture;
        break;
      case 'check':
        soundPath = SOUND_PATHS.check;
        break;
      case 'invalid':
        soundPath = SOUND_PATHS.invalid;
        break;
    }
    
    if (!soundPath) {
      console.error(`Invalid sound type or missing piece info: ${type}`);
      return;
    }
    
    const audio = getAudio(soundPath);
    
    // Reset the audio position to start if it's still playing
    audio.currentTime = 0;
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Try unlocking audio context if this is first interaction
        if (!audioUnlocked) {
          initAudio();
        }
      });
    }
  } catch (err) {
    console.error('Sound error:', err);
  }
}

// Export sound types as constants
export const SoundTypes = {
  MOVE: 'move' as const,
  CAPTURE: 'capture' as const,
  CHECK: 'check' as const,
  INVALID: 'invalid' as const,
  PIECE: 'piece' as const
};