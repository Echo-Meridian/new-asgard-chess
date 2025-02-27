/**
 * Chess game types
 */

export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  promotion?: PieceType;
  notation?: string;
}

export interface GameState {
  isOver: boolean;
  winner: PieceColor | null;
  message: string;
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'master';

export interface AIDifficulty {
  level: DifficultyLevel;
  elo: number;
  depth: number;
  timeMs: number;
}

export const DIFFICULTY_SETTINGS: Record<DifficultyLevel, AIDifficulty> = {
  easy: {
    level: 'easy',
    elo: 1200,
    depth: 5,
    timeMs: 500
  },
  medium: {
    level: 'medium',
    elo: 1600,
    depth: 10,
    timeMs: 1000
  },
  hard: {
    level: 'hard',
    elo: 2000,
    depth: 15,
    timeMs: 1500
  },
  master: {
    level: 'master',
    elo: 2400,
    depth: 18,
    timeMs: 2000
  }
};

// Standard chess notation utilities
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

/**
 * Convert position to algebraic notation (e.g. e4)
 */
export function positionToAlgebraic(pos: Position): string {
  return `${FILES[pos.col]}${RANKS[pos.row]}`;
}

/**
 * Convert algebraic notation to position
 */
export function algebraicToPosition(algebraic: string): Position {
  const file = algebraic[0];
  const rank = algebraic[1];
  
  return {
    col: FILES.indexOf(file),
    row: RANKS.indexOf(rank)
  };
}

/**
 * Convert UCI move format (e.g. e2e4) to Move object
 */
export function uciToMove(uci: string): Move {
  const from = algebraicToPosition(uci.substring(0, 2));
  const to = algebraicToPosition(uci.substring(2, 4));
  
  let promotion: PieceType | undefined;
  if (uci.length === 5) {
    const promotionChar = uci[4];
    const promotionMap: Record<string, PieceType> = {
      'q': 'queen',
      'r': 'rook',
      'b': 'bishop',
      'n': 'knight'
    };
    promotion = promotionMap[promotionChar];
  }
  
  return { from, to, promotion };
}

/**
 * Convert Move object to UCI format
 */
export function moveToUci(move: Move): string {
  const fromAlg = positionToAlgebraic(move.from);
  const toAlg = positionToAlgebraic(move.to);
  
  let uci = `${fromAlg}${toAlg}`;
  
  if (move.promotion) {
    const promotionMap: Record<PieceType, string> = {
      'queen': 'q',
      'rook': 'r',
      'bishop': 'b',
      'knight': 'n',
      'king': '',
      'pawn': '',
    };
    uci += promotionMap[move.promotion];
  }
  
  return uci;
}