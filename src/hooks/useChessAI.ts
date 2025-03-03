import { useState, useEffect, useCallback, useRef } from 'react';
import { stockfish, StockfishConfig } from '@/ai/stockfish';
import { boardToFEN } from '@/ai/fen-converter';
import { uciToMove } from '@/ai/move-parser';
import { playSound, SoundTypes } from '@/utils/soundUtils';
import type { 
  ChessPiece, 
  PieceColor, 
  Position, 
  Move,
  DifficultyLevel 
} from '@/types/chess';

// Difficulty level settings
export const DIFFICULTY_SETTINGS: Record<DifficultyLevel, StockfishConfig> = {
  easy: { elo: 1350, depth: 5, time: 1000 },
  medium: { elo: 1600, depth: 8, time: 1500 },
  hard: { elo: 1900, depth: 12, time: 2000 },
  master: { elo: 2400, depth: 15, time: 3000 }
};

// Hook options
interface UseChessAIOptions {
  autoInit?: boolean;
  initialDifficulty?: DifficultyLevel;
}

/**
 * Hook for using the Chess AI in React components
 * 
 * This hook provides a clean interface to the Stockfish engine and handles
 * initialization, state management, and error handling.
 */
export function useChessAI(options: UseChessAIOptions = {}) {
  const { autoInit = true, initialDifficulty = 'medium' } = options;
  
  // State
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>(initialDifficulty);
  
  // Refs to prevent initialization loops
  const isInitializingRef = useRef(false);
  const initAttemptCountRef = useRef(0);
  const difficultyRef = useRef(initialDifficulty);
  const maxInitAttempts = 3;
  
  // Update ref when difficulty changes
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);
  
  /**
   * Initialize the AI engine
   */
  const init = useCallback(async () => {
    // Prevent concurrent initialization attempts
    if (isInitializingRef.current) {
      return false;
    }
    
    // Check for too many initialization attempts
    if (initAttemptCountRef.current >= maxInitAttempts) {
      setError(`Failed to initialize after ${maxInitAttempts} attempts`);
      return false;
    }
    
    isInitializingRef.current = true;
    initAttemptCountRef.current++;
    
    try {
      setLoading(true);
      setError(null);
      
      const success = await stockfish.init();
      
      if (success) {
        // Set difficulty
        const settings = DIFFICULTY_SETTINGS[difficultyRef.current];
        if (settings.elo) {
          await stockfish.setSkillLevel(settings.elo);
        }
        
        setInitialized(true);
        return true;
      } else {
        setError('Failed to initialize chess AI');
        setInitialized(false);
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setInitialized(false);
      return false;
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  }, []);
  
  /**
   * Set the difficulty level
   */
  const setDifficulty = useCallback(async (level: DifficultyLevel) => {
    setDifficultyState(level);
    
    if (initialized) {
      try {
        const settings = DIFFICULTY_SETTINGS[level];
        if (settings.elo) {
          await stockfish.setSkillLevel(settings.elo);
        }
      } catch (err) {
        console.error('Error setting difficulty:', err);
      }
    }
  }, [initialized]);
  
  /**
   * Get the best move from the AI
   */
  const getAIMove = useCallback(async (
    board: (ChessPiece | null)[][],
    currentPlayer: PieceColor,
    castlingRights: { [key: string]: boolean } = {},
    enPassantTarget: Position | null = null
  ): Promise<Move | null> => {
    // Ensure the AI is initialized
    if (!initialized && !isInitializingRef.current) {
      const success = await init();
      if (!success) {
        return null;
      }
    }
    
    if (!initialized) {
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Convert board to FEN
      const fen = boardToFEN(board, currentPlayer, castlingRights, enPassantTarget);
      
      // Set position
      await stockfish.setPosition(fen);
      
      // Get settings for current difficulty
      const settings = DIFFICULTY_SETTINGS[difficulty];
      
      // Get best move
      const bestMoveUci = await stockfish.getBestMove(settings);
      
      if (!bestMoveUci) {
        return null;
      }
      
      // Convert UCI move to our Move format
      const move = uciToMove(bestMoveUci);
      
      // Play sound
      playSound(SoundTypes.MOVE);
      
      return move;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error calculating move');
      return null;
    } finally {
      setLoading(false);
    }
  }, [initialized, init, difficulty]);
  
  /**
   * Get a hint (best move destination) for the current player
   */
  const getHint = useCallback(async (
    board: (ChessPiece | null)[][],
    currentPlayer: PieceColor,
    castlingRights: { [key: string]: boolean } = {},
    enPassantTarget: Position | null = null
  ): Promise<Position | null> => {
    // Ensure the AI is initialized
    if (!initialized && !isInitializingRef.current) {
      const success = await init();
      if (!success) {
        return null;
      }
    }
    
    if (!initialized) {
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Convert board to FEN
      const fen = boardToFEN(board, currentPlayer, castlingRights, enPassantTarget);
      
      // Set position
      await stockfish.setPosition(fen);
      
      // Get settings for current difficulty
      const settings = DIFFICULTY_SETTINGS[difficulty];
      
      // Analyze position
      const analysis = await stockfish.analyzePosition(settings);
      
      if (!analysis.move) {
        return null;
      }
      
      // Convert UCI move to our Move format
      const move = uciToMove(analysis.move);
      
      // Return destination position
      return move.to;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error calculating hint');
      return null;
    } finally {
      setLoading(false);
    }
  }, [initialized, init, difficulty]);
  
  /**
   * Analyze the current position
   */
  const analyzePosition = useCallback(async (
    board: (ChessPiece | null)[][],
    currentPlayer: PieceColor,
    castlingRights: { [key: string]: boolean } = {},
    enPassantTarget: Position | null = null
  ) => {
    // Ensure the AI is initialized
    if (!initialized && !isInitializingRef.current) {
      const success = await init();
      if (!success) {
        return { bestMove: null, score: 0, depth: 0 };
      }
    }
    
    if (!initialized) {
      return { bestMove: null, score: 0, depth: 0 };
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Convert board to FEN
      const fen = boardToFEN(board, currentPlayer, castlingRights, enPassantTarget);
      
      // Set position
      await stockfish.setPosition(fen);
      
      // Use higher depth for analysis
      const analysisConfig: StockfishConfig = {
        depth: 15,
        time: 2000
      };
      
      // Analyze position
      const analysis = await stockfish.analyzePosition(analysisConfig);
      
      // Convert UCI move to our Move format
      const bestMove = analysis.move ? uciToMove(analysis.move) : null;
      
      return {
        bestMove,
        score: analysis.score,
        depth: analysis.depth
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error analyzing position');
      return { bestMove: null, score: 0, depth: 0 };
    } finally {
      setLoading(false);
    }
  }, [initialized, init]);
  
  // Initialize AI on mount if autoInit is true
  useEffect(() => {
    // Reset initialization state on mount
    initAttemptCountRef.current = 0;
    
    if (autoInit) {
      init().catch(err => console.error('Auto-init failed:', err));
    }
    
    // Clean up on unmount
    return () => {
      stockfish.dispose();
    };
  }, [autoInit, init]);
  
  // Reset error counter when component receives focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initAttemptCountRef.current = 0;
      }
    };
    
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);
  
  return {
    initialized,
    loading,
    error,
    difficulty,
    setDifficulty,
    getAIMove,
    getHint,
    analyzePosition,
    init
  };
}