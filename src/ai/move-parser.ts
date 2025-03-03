/**
 * Utility functions for parsing and converting chess moves
 */
import type { Move, PieceType, Position } from '@/types/chess';

/**
 * Convert a UCI move string to our internal Move format
 * 
 * @param uciString UCI move string (e.g., "e2e4", "e7e8q")
 * @returns Move object with from and to positions
 */
export function uciToMove(uciString: string): Move {
  // Validate UCI string format
  if (!isValidUciString(uciString)) {
    throw new Error(`Invalid UCI move string: ${uciString}`);
  }
  
  // Extract positions from UCI string
  const fromCol = uciString.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const fromRow = 8 - parseInt(uciString[1]); // '1' -> 7, '8' -> 0
  const toCol = uciString.charCodeAt(2) - 97;
  const toRow = 8 - parseInt(uciString[3]);
  
  // Check for promotion
  let promotion: PieceType | undefined;
  if (uciString.length === 5) {
    promotion = uciCharToPieceType(uciString[4]);
  }
  
  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    promotion
  };
}

/**
 * Convert our internal Move format to a UCI move string
 * 
 * @param move Move object
 * @returns UCI move string
 */
export function moveToUci(move: Move): string {
  // Convert positions to UCI format
  const fromFile = String.fromCharCode(97 + move.from.col); // 0 -> 'a', 7 -> 'h'
  const fromRank = 8 - move.from.row; // 7 -> '1', 0 -> '8'
  const toFile = String.fromCharCode(97 + move.to.col);
  const toRank = 8 - move.to.row;
  
  // Create the basic UCI string
  let uciString = `${fromFile}${fromRank}${toFile}${toRank}`;
  
  // Add promotion piece if applicable
  if (move.promotion) {
    uciString += pieceTypeToUciChar(move.promotion);
  }
  
  return uciString;
}

/**
 * Validate if a string is a valid UCI move format
 */
function isValidUciString(uciString: string): boolean {
  // Basic UCI move: 4 characters (e.g., "e2e4")
  // UCI move with promotion: 5 characters (e.g., "e7e8q")
  if (uciString.length !== 4 && uciString.length !== 5) {
    return false;
  }
  
  // Check file characters (a-h)
  if (uciString[0] < 'a' || uciString[0] > 'h' || uciString[2] < 'a' || uciString[2] > 'h') {
    return false;
  }
  
  // Check rank characters (1-8)
  if (uciString[1] < '1' || uciString[1] > '8' || uciString[3] < '1' || uciString[3] > '8') {
    return false;
  }
  
  // Check promotion piece if present
  if (uciString.length === 5) {
    const promotionChar = uciString[4].toLowerCase();
    if (promotionChar !== 'q' && promotionChar !== 'r' && promotionChar !== 'b' && promotionChar !== 'n') {
      return false;
    }
  }
  
  return true;
}

/**
 * Convert a UCI promotion character to our internal PieceType
 */
function uciCharToPieceType(char: string): PieceType {
  switch (char.toLowerCase()) {
    case 'q': return 'queen';
    case 'r': return 'rook';
    case 'b': return 'bishop';
    case 'n': return 'knight';
    default: throw new Error(`Invalid promotion character: ${char}`);
  }
}

/**
 * Convert our internal PieceType to a UCI promotion character
 */
function pieceTypeToUciChar(pieceType: PieceType): string {
  switch (pieceType) {
    case 'queen': return 'q';
    case 'rook': return 'r';
    case 'bishop': return 'b';
    case 'knight': return 'n';
    default: throw new Error(`Invalid promotion piece type: ${pieceType}`);
  }
}

/**
 * Convert algebraic notation (e.g., "e4") to a Position
 */
export function algebraicToPosition(algebraic: string): Position {
  if (algebraic.length !== 2) {
    throw new Error(`Invalid algebraic notation: ${algebraic}`);
  }
  
  const file = algebraic[0].toLowerCase();
  const rank = algebraic[1];
  
  if (file < 'a' || file > 'h' || rank < '1' || rank > '8') {
    throw new Error(`Invalid algebraic notation: ${algebraic}`);
  }
  
  const col = file.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const row = 8 - parseInt(rank); // '1' -> 7, '8' -> 0
  
  return { row, col };
}

/**
 * Convert a Position to algebraic notation
 */
export function positionToAlgebraic(position: Position): string {
  const file = String.fromCharCode(97 + position.col); // 0 -> 'a', 7 -> 'h'
  const rank = 8 - position.row; // 7 -> '1', 0 -> '8'
  
  return `${file}${rank}`;
}