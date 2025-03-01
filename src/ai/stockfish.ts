/**
 * Stockfish chess engine integration
 */

import { createStockfishWorker } from '@/utils/workerUtils';

// Configuration options for Stockfish engine
export interface StockfishConfig {
  depth?: number;   // Search depth (higher = stronger but slower)
  time?: number;    // Time in milliseconds to think
  elo?: number;     // Target ELO rating for skill level
}

// Move information returned from analysis
export interface MoveAnalysis {
  move: string;     // Move in UCI format (e.g. "e2e4")
  score: number;    // Centipawn score
  depth: number;    // Depth of analysis
  line?: string[];  // Principal variation (sequence of best moves)
}

/**
 * Main Stockfish engine interface
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private initialized: boolean = false;
  private messageCallbacks: Map<string, (data: string) => void> = new Map();
  private readonly wasmSupported: boolean = typeof WebAssembly === 'object';
  private commandQueue: string[] = [];
  private isReady: boolean = false;
  
  /**
   * Initialize the Stockfish engine
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    if (typeof window === 'undefined') {
      console.error('Stockfish engine can only be initialized in browser environment');
      return;
    }
    
    try {
      // Use a static worker path to avoid Turbopack errors
      this.worker = createStockfishWorker();
      
      // Set up message handling
      this.worker.onmessage = (e) => this.handleMessage(e.data);
      
      // Send initial UCI command and wait for readiness
      await this.sendCommand('uci');
      await this.sendCommand('isready');
      
      this.initialized = true;
      console.log('Stockfish engine initialized successfully');
      
      // Process any queued commands
      while (this.commandQueue.length > 0) {
        const cmd = this.commandQueue.shift();
        if (cmd) await this.sendCommand(cmd);
      }
    } catch (error) {
      console.error('Failed to initialize Stockfish engine:', error);
      throw new Error('Stockfish initialization failed');
    }
  }
  
  /**
   * Set position on the board using FEN notation
   */
  async setPosition(fen: string): Promise<void> {
    await this.sendCommand(`position fen ${fen}`);
  }
  
  /**
   * Set position from a sequence of moves from the starting position
   */
  async setPositionFromMoves(moves: string[]): Promise<void> {
    await this.sendCommand(`position startpos moves ${moves.join(' ')}`);
  }
  
  /**
   * Get the best move for the current position
   */
  async getBestMove(config: StockfishConfig = {}): Promise<string> {
    const { depth = 15, time = 1000 } = config;
    
    return new Promise((resolve) => {
      const moveCallback = (data: string) => {
        const match = data.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (match) {
          resolve(match[1]);
        }
      };
      
      this.messageCallbacks.set('bestmove', moveCallback);
      
      // Set parameters based on config
      if (config.elo) {
        this.setSkillLevel(config.elo);
      }
      
      this.sendCommand(`go depth ${depth} movetime ${time}`);
    });
  }
  
  /**
   * Analyze the current position
   */
  async analyzePosition(config: StockfishConfig = {}): Promise<MoveAnalysis> {
    const { depth = 15, time = 1000 } = config;
    
    return new Promise((resolve) => {
      let bestAnalysis: MoveAnalysis | null = null;
      
      const analysisCallback = (data: string) => {
        // Parse info string for move analysis
        if (data.startsWith('info depth')) {
          const scoreMatch = data.match(/score cp (-?\d+)/);
          const depthMatch = data.match(/depth (\d+)/);
          const pv = data.match(/pv (.+)/);
          
          if (scoreMatch && depthMatch && pv) {
            const score = parseInt(scoreMatch[1]);
            const depth = parseInt(depthMatch[1]);
            const moves = pv[1].split(' ');
            
            bestAnalysis = {
              move: moves[0],
              score,
              depth,
              line: moves,
            };
          }
        }
        
        // Resolve when bestmove is found
        if (data.startsWith('bestmove')) {
          if (bestAnalysis) {
            resolve(bestAnalysis);
          } else {
            const match = data.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
            resolve({
              move: match ? match[1] : '',
              score: 0,
              depth: 0
            });
          }
        }
      };
      
      this.messageCallbacks.set('analysis', analysisCallback);
      
      if (config.elo) {
        this.setSkillLevel(config.elo);
      }
      
      this.sendCommand(`go depth ${depth} movetime ${time}`);
    });
  }
  
  /**
   * Set the skill level of the engine (ELO rating)
   * 
   * @param elo Target ELO rating (roughly 1000-2800)
   */
  async setSkillLevel(elo: number): Promise<void> {
    // Convert ELO to skill level (0-20)
    // Formula approximation: skill = (elo - 1000) / 90
    const skillLevel = Math.max(0, Math.min(20, Math.floor((elo - 1000) / 90)));
    
    await this.sendCommand(`setoption name Skill Level value ${skillLevel}`);
    
    // Set search depth based on skill level
    const depth = Math.max(1, Math.min(20, Math.floor(skillLevel / 2)));
    await this.sendCommand(`setoption name Search Depth value ${depth}`);
  }
  
  /**
   * Stop the current analysis
   */
  async stop(): Promise<void> {
    await this.sendCommand('stop');
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.messageCallbacks.clear();
    }
  }
  
  /**
   * Send a command to the Stockfish engine
   */
  private async sendCommand(command: string): Promise<void> {
    if (!this.isReady && !command.includes('isready')) {
      this.commandQueue.push(command);
      return;
    }
    
    if (!this.worker) {
      throw new Error('Stockfish engine not initialized');
    }
    
    return new Promise<void>((resolve) => {
      const readyCallback = (data: string) => {
        if (data.includes('readyok')) {
          this.isReady = true;
          resolve();
        }
      };
      
      if (command === 'isready') {
        this.messageCallbacks.set('ready', readyCallback);
      } else {
        // For other commands, resolve immediately
        setTimeout(resolve, 0);
      }
      
      this.worker!.postMessage(command);
    });
  }
  
  /**
   * Handle messages from the Stockfish worker
   */
  private handleMessage(data: string): void {
    // Call all registered callbacks with the message
    this.messageCallbacks.forEach((callback) => {
      callback(data);
    });
    
    // Remove callbacks once we get the bestmove
    if (data.startsWith('bestmove')) {
      this.messageCallbacks.delete('bestmove');
      this.messageCallbacks.delete('analysis');
    }
    
    // Remove ready callback once engine is ready
    if (data.includes('readyok')) {
      this.messageCallbacks.delete('ready');
    }
  }
}