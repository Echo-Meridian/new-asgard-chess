/**
 * Sound utilities for chess game
 */

// Sound types supported by the game
type SoundType = 'move' | 'capture' | 'check' | 'invalid';

// Basic sound map
const soundMap = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  invalid: '/sounds/invalid.mp3',
};

/**
 * Play a sound effect with robust error handling for mobile devices
 * 
 * @param type The type of sound to play
 */
export function playSound(type: SoundType): void {
  if (typeof window === 'undefined') return;

  try {
    const soundPath = soundMap[type];
    console.log(`Playing ${type} sound from ${soundPath}`);
    
    const audio = new Audio(soundPath);
    audio.volume = 0.5;
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => console.log('Sound played successfully'))
        .catch(e => {
          console.error('Audio play error:', e);
          
          // iOS often requires user interaction before playing sounds
          // Add a one-time click listener to try playing the sound again
          const retryOnInteraction = () => {
            const retryAudio = new Audio(soundPath);
            retryAudio.volume = 0.5;
            retryAudio.play().catch(err => console.error('Retry failed:', err));
            
            // Remove the event listener after trying once
            window.removeEventListener('click', retryOnInteraction);
            window.removeEventListener('touchend', retryOnInteraction);
          };
          
          window.addEventListener('click', retryOnInteraction, { once: true });
          window.addEventListener('touchend', retryOnInteraction, { once: true });
        });
    }
  } catch (err) {
    console.error('Sound error:', err);
  }
}

// Export sound types
export const SoundTypes = {
  MOVE: 'move' as SoundType,
  CAPTURE: 'capture' as SoundType,
  CHECK: 'check' as SoundType,
  INVALID: 'invalid' as SoundType,
};