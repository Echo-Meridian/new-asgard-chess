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
 * Helper to wrap promises with a timeout. If the promise does not resolve
 * within the specified time, it will be rejected.
 */
function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
    promise.then(value => {
      clearTimeout(timer);
      resolve(value);
    }).catch(error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Chess AI Manager - now with lazy initialization, dependency injection, consistent FEN generation,
 * and timeout support for engine operations.
 */
export class ChessAI {
  private engine: StockfishEngine;
  private initialized: boolean = false;
  private difficulty: DifficultyLevel = 'medium';
  // Timeout values for various operations (milliseconds) - increased to avoid timeouts
  private readonly MOVE_TIMEOUT_MS = 30000;    // For getBestMove (more complex)
  private readonly HINT_TIMEOUT_MS = 25000;    // For getHint (first move hint needs more time)
  private readonly ANALYSIS_TIMEOUT_MS = 25000; // For analyzePosition
  // Track consecutive failures to implement backoff
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  
  /**
   * Accepts an optional engine instance for dependency injection (useful for testing)
   */
  constructor(engine?: StockfishEngine) {
    this.engine = engine || new StockfishEngine();
  }
  
  /**
   * Initialize the AI engine.
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;
    
    // If we've had too many consecutive failures, wait before trying again
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      console.warn(`Too many consecutive failures (${this.consecutiveFailures}), implementing backoff`);
      await new Promise(resolve => setTimeout(resolve, 2000 * this.consecutiveFailures));
    }
    
    try {
      await this.engine.init();
      await this.setDifficulty(this.difficulty);
      this.initialized = true;
      this.consecutiveFailures = 0; // Reset counter on success
      console.log('Chess AI initialized successfully');
      return true;
    } catch (error) {
      this.consecutiveFailures++;
      console.error('Failed to initialize Chess AI:', error);
      throw new Error("Initialization failed");
    }
  }
  
  /**
   * Ensure the engine is initialized before proceeding.
   * This reduces duplicated initialization code in getBestMove, analyzePosition, etc.
   * Added retry backoff for robustness.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      const success = await this.init();
      if (!success) {
        throw new Error("Engine failed to initialize");
      }
    }
  }
  
  /**
   * Set the AI difficulty level.
   * If the engine is already initialized, updates the skill level immediately.
   */
  async setDifficulty(level: DifficultyLevel): Promise<void> {
    this.difficulty = level;
    const settings = DIFFICULTY_SETTINGS[level];
    if (this.initialized) {
      await this.engine.setSkillLevel(settings.elo);
    }
  }
  
  /**
   * Get the best move for the current position.
   * Consistently converts the board to FEN (including castling rights and en passant)
   * and wraps the engine call with a timeout for improved responsiveness.
   */
  async getBestMove(
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor,
    castlingRights: { [key: string]: boolean } = {},
    enPassantTarget: Position | null = null
  ): Promise<Move | null> {
    await this.ensureInitialized();
    try {
      // Generate a consistent FEN string that fully describes the board state.
      const fen = boardToFEN(board, currentPlayer, castlingRights, enPassantTarget);
      console.log('FEN for AI:', fen);
      
      // Set the position in the engine.
      await this.engine.setPosition(fen);
      
      // Retrieve settings for the current difficulty.
      const settings = DIFFICULTY_SETTINGS[this.difficulty];
      
      // Get the best move from the engine with timeout protection.
      const bestMoveUci = await promiseWithTimeout(
      this.engine.getBestMove({
      depth: settings.depth,
      time: settings.timeMs,
      elo: settings.elo
      }),
      this.MOVE_TIMEOUT_MS
      );
      
      if (!bestMoveUci) return null;
      console.log('AI selected move:', bestMoveUci);
      
      // Convert the UCI move to our internal Move format.
      const move = uciToMove(bestMoveUci);
      
      // Play a move sound to improve UX.
      playSound(SoundTypes.MOVE);
      
      // Reset failure counter on success
      this.consecutiveFailures = 0;
      
      return move;
    } catch (error) {
      this.consecutiveFailures++;
      console.error('Error getting AI move:', error);
      
      // If we've had multiple failures, force engine reinitialization
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        console.warn('Multiple consecutive failures, forcing engine reinitialization');
        this.initialized = false;
        this.engine.dispose();
        this.engine = new StockfishEngine();
      }
      
      throw error;
    }
  }
  
  /**
   * Analyze the current position and return evaluation details.
   * Now uses a consistent FEN with full board state and includes timeout logic.
   */
  async analyzePosition(
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor,
    castlingRights: { [key: string]: boolean } = {},
    enPassantTarget: Position | null = null
  ): Promise<{ bestMove: Move | null, score: number, depth: number }> {
    await this.ensureInitialized();
    try {
      // Generate FEN with full state (for consistency with getBestMove)
      const fen = boardToFEN(board, currentPlayer, castlingRights, enPassantTarget);
      
      // Set the position in the engine.
      await this.engine.setPosition(fen);
      
      // Analyze the position with a timeout to avoid hanging.
      const analysis = await promiseWithTimeout(
        this.engine.analyzePosition({
          depth: 18,
          time: 1000
        }),
        this.ANALYSIS_TIMEOUT_MS
      );
      
      // Convert UCI move (if any) to our Move format.
      const bestMove = analysis.move ? uciToMove(analysis.move) : null;
      
      // Reset failure counter on success
      this.consecutiveFailures = 0;
      
      return {
        bestMove,
        score: analysis.score,
        depth: analysis.depth
      };
    } catch (error) {
      this.consecutiveFailures++;
      console.error('Error analyzing position:', error);
      
      // If we've had multiple failures, force engine reinitialization
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        console.warn('Multiple consecutive failures, forcing engine reinitialization');
        this.initialized = false;
        this.engine.dispose();
        this.engine = new StockfishEngine();
      }
      
      throw error;
    }
  }
  
  /**
   * Get a hint for the current position (i.e., the destination square of the best move).
   */
  async getHint(
    board: (ChessPiece | null)[][], 
    currentPlayer: PieceColor,
    castlingRights: { [key: string]: boolean } = {},
    enPassantTarget: Position | null = null
  ): Promise<Position | null> {
    const analysis = await this.analyzePosition(board, currentPlayer, castlingRights, enPassantTarget);
    return analysis.bestMove ? analysis.bestMove.to : null;
  }
  
  /**
   * Clean up resources used by the engine.
   */
  dispose(): void {
    if (this.initialized) {
      this.engine.dispose();
      this.initialized = false;
    }
  }
}

// Create a singleton instance of ChessAI.
export const chessAI = new ChessAI();