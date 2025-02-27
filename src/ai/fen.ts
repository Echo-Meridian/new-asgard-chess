/**
 * FEN notation utilities for chess positions
 * FEN - Forsyth-Edwards Notation
 */

import type { ChessPiece, PieceColor } from '@/types/chess';

/**
 * Convert a chess board to FEN notation
 */
export function boardToFEN(
  board: (ChessPiece | null)[][], 
  currentPlayer: PieceColor,
  castlingRights: {[key: string]: boolean} = {},
  enPassantTarget: { row: number, col: number } | null = null
): string {
  // 1. Piece placement (from 8th rank to 1st rank)
  const piecePlacement = board.map(row => {
    let rowStr = '';
    let emptyCount = 0;
    
    for (let i = 0; i < row.length; i++) {
      const piece = row[i];
      
      if (piece === null) {
        emptyCount++;
      } else {
        // If there were empty squares before this piece, add the count
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        
        // Add the piece character (uppercase for white, lowercase for black)
        const pieceChar = getPieceChar(piece);
        rowStr += pieceChar;
      }
    }
    
    // If the row ends with empty squares, add the count
    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    
    return rowStr;
  }).join('/');
  
  // 2. Active color
  const activeColor = currentPlayer === 'white' ? 'w' : 'b';
  
  // 3. Castling availability
  let castling = '';
  if (castlingRights[`white-rook-right`] !== false && castlingRights[`white-king`] !== false) castling += 'K';
  if (castlingRights[`white-rook-left`] !== false && castlingRights[`white-king`] !== false) castling += 'Q';
  if (castlingRights[`black-rook-right`] !== false && castlingRights[`black-king`] !== false) castling += 'k';
  if (castlingRights[`black-rook-left`] !== false && castlingRights[`black-king`] !== false) castling += 'q';
  
  // If no castling rights, use '-'
  if (castling === '') castling = '-';
  
  // 4. En passant target square
  let enPassant = '-';
  if (enPassantTarget) {
    const file = 'abcdefgh'[enPassantTarget.col];
    const rank = 8 - enPassantTarget.row;
    enPassant = `${file}${rank}`;
  }
  
  // 5. Halfmove clock (always 0 for simplicity)
  const halfmoveClock = '0';
  
  // 6. Fullmove number (always 1 for simplicity)
  const fullmoveNumber = '1';
  
  // Combine all parts to form the FEN string
  return [
    piecePlacement,
    activeColor,
    castling,
    enPassant,
    halfmoveClock,
    fullmoveNumber
  ].join(' ');
}

/**
 * Convert a FEN string to a chess board
 */
export function FENToBoard(fen: string): { 
  board: (ChessPiece | null)[][], 
  currentPlayer: PieceColor,
  castlingRights: {[key: string]: boolean},
  enPassantTarget: { row: number, col: number } | null
} {
  // Split the FEN string into its components
  const [piecePlacement, activeColor, castling, enPassant, /*halfmoveClock*/, /*fullmoveNumber*/] = fen.split(' ');
  
  // 1. Parse piece placement
  const rows = piecePlacement.split('/');
  const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  for (let i = 0; i < 8; i++) {
    let colIndex = 0;
    const row = rows[i];
    
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      
      if (isNaN(parseInt(char))) {
        // It's a piece
        board[i][colIndex] = parsePieceChar(char);
        colIndex++;
      } else {
        // It's a number of empty squares
        const emptyCount = parseInt(char);
        colIndex += emptyCount;
      }
    }
  }
  
  // 2. Parse active color
  const currentPlayer: PieceColor = activeColor === 'w' ? 'white' : 'black';
  
  // 3. Parse castling availability
  const castlingRights = {
    'white-king': castling.includes('K') || castling.includes('Q'),
    'white-rook-right': castling.includes('K'),
    'white-rook-left': castling.includes('Q'),
    'black-king': castling.includes('k') || castling.includes('q'),
    'black-rook-right': castling.includes('k'),
    'black-rook-left': castling.includes('q')
  };
  
  // 4. Parse en passant target square
  let enPassantTarget = null;
  if (enPassant !== '-') {
    const col = 'abcdefgh'.indexOf(enPassant[0]);
    const row = 8 - parseInt(enPassant[1]);
    enPassantTarget = { row, col };
  }
  
  return { board, currentPlayer, castlingRights, enPassantTarget };
}

/**
 * Get the FEN character for a chess piece
 */
function getPieceChar(piece: ChessPiece): string {
  const pieceMap: Record<string, string> = {
    'pawn': 'p',
    'knight': 'n',
    'bishop': 'b',
    'rook': 'r',
    'queen': 'q',
    'king': 'k'
  };
  
  const char = pieceMap[piece.type];
  return piece.color === 'white' ? char.toUpperCase() : char;
}

/**
 * Parse a FEN character into a chess piece
 */
function parsePieceChar(char: string): ChessPiece {
  const isWhite = char === char.toUpperCase();
  const lowerChar = char.toLowerCase();
  
  const pieceMap: Record<string, string> = {
    'p': 'pawn',
    'n': 'knight',
    'b': 'bishop',
    'r': 'rook',
    'q': 'queen',
    'k': 'king'
  };
  
  return {
    type: pieceMap[lowerChar] as any,
    color: isWhite ? 'white' : 'black'
  };
}