/**
 * ChessAI Manager - Integrates Stockfish with the chess game
 */

import { StockfishEngine } from './stockfish';
import { boardToFEN } from './fen';
import { 
  ChessPiece, 
  PieceColor, 
  Position,
  Move,
  DifficultyLevel,
  DIFFICULTY_SETTINGS,
  uciToMove
} from '@/types/chess';
import { playSound, SoundTypes } from '@/utils/soundUtils';

/**
 * Chess AI Manager
 */
export class ChessAI {
  private engine: StockfishEngine;
  private initialized: boolean = false;
  private difficulty: DifficultyLevel = 'medium';
  
  constructor() {
    this.engine = new StockfishEngine();
  }
  
  /**
   * Initialize the AI engine
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      await this.engine.init();
      await this.setDifficulty(this.difficulty);
      this.initialized = true;
      console.log('Chess AI initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Chess AI:', error);
      return false;
    }
  }
  
  /**
   * Set the AI difficulty level
   */
  async setDifficulty(level: DifficultyLevel): Promise<void> {
    this.difficulty = level;
    const settings = DIFFICULTY_SETTINGS[level];
    
    if (this.initialized) {
      await this.engine.setSkillLevel(settings.elo);
    }
  }
  
  /**
   * Get the best move for the current position
   */
  async getBestMove(
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor,
    castlingRights: {[key: string]: boolean} = {},
    enPassantTarget: Position | null = null
  ): Promise<Move | null> {
    if (!this.initialized) {
      const success = await this.init();
      if (!success) return null;
    }
    
    try {
      // Convert board to FEN
      const fen = boardToFEN(board, currentPlayer, castlingRights, enPassantTarget);
      console.log('FEN for AI:', fen);
      
      // Set the position in the engine
      await this.engine.setPosition(fen);
      
      // Get the difficulty settings
      const settings = DIFFICULTY_SETTINGS[this.difficulty];
      
      // Get the best move
      const bestMoveUci = await this.engine.getBestMove({
        depth: settings.depth,
        time: settings.timeMs,
        elo: settings.elo
      });
      
      if (!bestMoveUci) return null;
      
      console.log('AI selected move:', bestMoveUci);
      
      // Convert UCI move to our Move format
      const move = uciToMove(bestMoveUci);
      
      // Play a move sound for better UX
      playSound(SoundTypes.MOVE);
      
      return move;
    } catch (error) {
      console.error('Error getting AI move:', error);
      return null;
    }
  }
  
  /**
   * Analyze the current position and return evaluation
   */
  async analyzePosition(
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor
  ): Promise<{ bestMove: Move | null, score: number, depth: number }> {
    if (!this.initialized) {
      const success = await this.init();
      if (!success) return { bestMove: null, score: 0, depth: 0 };
    }
    
    try {
      // Convert board to FEN
      const fen = boardToFEN(board, currentPlayer);
      
      // Set the position in the engine
      await this.engine.setPosition(fen);
      
      // Analyze the position
      const analysis = await this.engine.analyzePosition({
        depth: 18,
        time: 1000
      });
      
      // Convert UCI move to our Move format
      const bestMove = analysis.move ? uciToMove(analysis.move) : null;
      
      return {
        bestMove,
        score: analysis.score,
        depth: analysis.depth
      };
    } catch (error) {
      console.error('Error analyzing position:', error);
      return { bestMove: null, score: 0, depth: 0 };
    }
  }
  
  /**
   * Get a hint for the current position
   */
  async getHint(
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor
  ): Promise<Position | null> {
    const { bestMove } = await this.analyzePosition(board, currentPlayer);
    return bestMove ? bestMove.to : null;
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.initialized) {
      this.engine.dispose();
      this.initialized = false;
    }
  }
}

// Create singleton instance
export const chessAI = new ChessAI();