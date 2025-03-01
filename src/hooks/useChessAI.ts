import { useState, useEffect, useCallback } from 'react';
import { chessAI } from '@/ai/chessAI';
import type { 
  ChessPiece, 
  PieceColor, 
  Position, 
  Move,
  DifficultyLevel 
} from '@/types/chess';

/**
 * Hook for using the Chess AI in React components
 */
export function useChessAI(options: {
  autoInit?: boolean;
  initialDifficulty?: DifficultyLevel;
} = {}) {
  const { autoInit = true, initialDifficulty = 'medium' } = options;
  
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>(initialDifficulty);
  
  // Initialize the AI
  const init = useCallback(async () => {
    console.log('Initializing Chess AI...');
    try {
      setLoading(true);
      setError(null);
      
      const success = await chessAI.init();
      console.log('Chess AI initialization result:', success);
      setInitialized(success);
      
      if (success) {
        await chessAI.setDifficulty(difficulty);
        console.log('Chess AI difficulty set to:', difficulty);
      } else {
        console.error('Failed to initialize chess AI');
        setError('Failed to initialize chess AI');
      }
    } catch (err) {
      console.error('Error initializing AI:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setInitialized(false);
    } finally {
      setLoading(false);
    }
  }, [difficulty]);
  
  // Set the difficulty level
  const setDifficulty = useCallback(async (level: DifficultyLevel) => {
    console.log('Setting difficulty to:', level);
    setDifficultyState(level);
    
    if (initialized) {
      try {
        await chessAI.setDifficulty(level);
        console.log('Difficulty set successfully to:', level);
      } catch (err) {
        console.error('Error setting difficulty:', err);
      }
    } else {
      console.log('AI not initialized yet, will set difficulty after initialization');
    }
  }, [initialized]);
  
  // Get the AI's move
  const getAIMove = useCallback(async (
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor,
    castlingRights: {[key: string]: boolean} = {},
    enPassantTarget: Position | null = null
  ): Promise<Move | null> => {
    console.log('Getting AI move, initialized:', initialized);
    if (!initialized) {
      console.log('AI not initialized, initializing now...');
      await init();
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Requesting best move for player:', currentPlayer);
      const move = await chessAI.getBestMove(
        board, 
        currentPlayer, 
        castlingRights, 
        enPassantTarget
      );
      
      console.log('AI returned move:', move);
      return move;
    } catch (err) {
      console.error('Error getting AI move:', err);
      setError(err instanceof Error ? err.message : 'Error calculating move');
      return null;
    } finally {
      setLoading(false);
    }
  }, [initialized, init]);
  
  // Get a hint for the player
  const getHint = useCallback(async (
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor
  ): Promise<Position | null> => {
    console.log('Getting hint, initialized:', initialized);
    if (!initialized) {
      console.log('AI not initialized, initializing now...');
      await init();
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Requesting hint for player:', currentPlayer);
      const hintPosition = await chessAI.getHint(board, currentPlayer);
      console.log('AI returned hint position:', hintPosition);
      return hintPosition;
    } catch (err) {
      console.error('Error getting hint:', err);
      setError(err instanceof Error ? err.message : 'Error calculating hint');
      return null;
    } finally {
      setLoading(false);
    }
  }, [initialized, init]);
  
  // Analyze the position
  const analyzePosition = useCallback(async (
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor
  ) => {
    if (!initialized) {
      await init();
    }
    
    try {
      setLoading(true);
      setError(null);
      
      return await chessAI.analyzePosition(board, currentPlayer);
    } catch (err) {
      console.error('Error analyzing position:', err);
      setError(err instanceof Error ? err.message : 'Error analyzing position');
      return { bestMove: null, score: 0, depth: 0 };
    } finally {
      setLoading(false);
    }
  }, [initialized, init]);
  
  // Clean up on unmount
  useEffect(() => {
    if (autoInit) {
      console.log('Auto-initializing Chess AI');
      init();
    }
    
    return () => {
      console.log('Disposing Chess AI');
      chessAI.dispose();
    };
  }, [autoInit, init]);
  
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