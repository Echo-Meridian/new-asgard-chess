/**
 * FEN notation utility functions for chess board representation
 * 
 * FEN (Forsyth-Edwards Notation) is a standard for describing chess positions
 * using a simple text format. This module provides functions to convert between
 * our internal board representation and FEN notation.
 */
import type { ChessPiece, PieceColor, Position, PieceType } from '@/types/chess';

/**
 * Convert a chess board to FEN notation
 * 
 * @param board The chess board
 * @param currentPlayer The current player
 * @param castlingRights Castling rights (e.g., { 'white-king': true, 'white-rook-right': true, ... })
 * @param enPassantTarget En passant target square (if any)
 * @returns FEN string
 */
export function boardToFEN(
  board: (ChessPiece | null)[][],
  currentPlayer: PieceColor,
  castlingRights: { [key: string]: boolean } = {},
  enPassantTarget: Position | null = null
): string {
  // 1. Board position
  const boardPart = boardPositionToFEN(board);
  
  // 2. Active color
  const activePart = currentPlayer.charAt(0); // 'w' or 'b'
  
  // 3. Castling availability
  const castlingPart = castlingRightsToFEN(castlingRights);
  
  // 4. En passant target square
  const enPassantPart = enPassantToFEN(enPassantTarget);
  
  // 5. Halfmove clock (not used in our implementation, so default to 0)
  const halfmovePart = '0';
  
  // 6. Fullmove number (not used in our implementation, so default to 1)
  const fullmovePart = '1';
  
  // Combine all parts
  return [
    boardPart,
    activePart,
    castlingPart,
    enPassantPart,
    halfmovePart,
    fullmovePart
  ].join(' ');
}

/**
 * Convert the board position to FEN notation
 */
function boardPositionToFEN(board: (ChessPiece | null)[][]): string {
  const ranks: string[] = [];
  
  // Process each rank (row) of the board
  for (let row = 0; row < 8; row++) {
    let rankString = '';
    let emptySquares = 0;
    
    // Process each file (column) in the rank
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      
      if (piece === null) {
        // Count empty squares
        emptySquares++;
      } else {
        // If there were empty squares before this piece, add them to the rank string
        if (emptySquares > 0) {
          rankString += emptySquares.toString();
          emptySquares = 0;
        }
        
        // Add the piece to the rank string
        rankString += pieceToFENChar(piece);
      }
    }
    
    // If there are empty squares at the end of the rank, add them to the rank string
    if (emptySquares > 0) {
      rankString += emptySquares.toString();
    }
    
    // Add the rank to the ranks array
    ranks.push(rankString);
  }
  
  // Combine all ranks with a '/' separator
  return ranks.join('/');
}

/**
 * Convert a piece to its FEN character representation
 */
function pieceToFENChar(piece: ChessPiece): string {
  let char = '';
  
  // Determine the base character based on piece type
  switch (piece.type) {
    case 'pawn':
      char = 'p';
      break;
    case 'knight':
      char = 'n';
      break;
    case 'bishop':
      char = 'b';
      break;
    case 'rook':
      char = 'r';
      break;
    case 'queen':
      char = 'q';
      break;
    case 'king':
      char = 'k';
      break;
  }
  
  // Convert to uppercase for white pieces
  if (piece.color === 'white') {
    char = char.toUpperCase();
  }
  
  return char;
}

/**
 * Convert castling rights to FEN format
 */
function castlingRightsToFEN(castlingRights: { [key: string]: boolean }): string {
  const canWhiteKingside = !castlingRights['white-king'] && !castlingRights['white-rook-right'];
  const canWhiteQueenside = !castlingRights['white-king'] && !castlingRights['white-rook-left'];
  const canBlackKingside = !castlingRights['black-king'] && !castlingRights['black-rook-right'];
  const canBlackQueenside = !castlingRights['black-king'] && !castlingRights['black-rook-left'];
  
  let castling = '';
  if (canWhiteKingside) castling += 'K';
  if (canWhiteQueenside) castling += 'Q';
  if (canBlackKingside) castling += 'k';
  if (canBlackQueenside) castling += 'q';
  
  return castling || '-';
}

/**
 * Convert en passant target to FEN format
 */
function enPassantToFEN(enPassantTarget: Position | null): string {
  if (!enPassantTarget) return '-';
  
  const file = String.fromCharCode(97 + enPassantTarget.col); // 'a' to 'h'
  const rank = 8 - enPassantTarget.row; // 1 to 8
  
  return file + rank;
}

/**
 * Parse a FEN string to a board representation
 */
export function fenToBoard(fen: string): {
  board: (ChessPiece | null)[][];
  currentPlayer: PieceColor;
  castlingRights: { [key: string]: boolean };
  enPassantTarget: Position | null;
} {
  // Split FEN string into its components
  const parts = fen.split(' ');
  if (parts.length < 6) {
    throw new Error(`Invalid FEN string format: ${fen}`);
  }
  
  // 1. Parse board position
  const boardPart = parts[0];
  const board = parseBoardPosition(boardPart);
  
  // 2. Parse active color
  const activePart = parts[1];
  const currentPlayer: PieceColor = activePart === 'w' ? 'white' : 'black';
  
  // 3. Parse castling availability
  const castlingPart = parts[2];
  const castlingRights = parseCastlingRights(castlingPart);
  
  // 4. Parse en passant target square
  const enPassantPart = parts[3];
  const enPassantTarget = parseEnPassantTarget(enPassantPart);
  
  // Return the complete board representation
  return {
    board,
    currentPlayer,
    castlingRights,
    enPassantTarget
  };
}

/**
 * Parse the board position part of a FEN string
 */
function parseBoardPosition(boardPart: string): (ChessPiece | null)[][] {
  const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  const ranks = boardPart.split('/');
  
  if (ranks.length !== 8) {
    throw new Error(`Invalid board position in FEN: ${boardPart}`);
  }
  
  // Process each rank
  for (let row = 0; row < 8; row++) {
    const rank = ranks[row];
    let col = 0;
    
    // Process each character in the rank
    for (let i = 0; i < rank.length; i++) {
      const char = rank[i];
      
      // If the character is a number, it represents empty squares
      if (/\d/.test(char)) {
        const emptySquares = parseInt(char);
        col += emptySquares;
      } else {
        // Otherwise, it represents a piece
        const piece = fenCharToPiece(char);
        board[row][col] = piece;
        col++;
      }
    }
    
    // Verify that the rank is complete
    if (col !== 8) {
      throw new Error(`Invalid rank in FEN: ${rank} (should have 8 squares)`);
    }
  }
  
  return board;
}

/**
 * Convert a FEN character to a chess piece
 */
function fenCharToPiece(char: string): ChessPiece {
  const color: PieceColor = char === char.toUpperCase() ? 'white' : 'black';
  const pieceType = charToPieceType(char.toLowerCase());
  
  return { type: pieceType, color };
}

/**
 * Map a FEN character to a piece type
 */
function charToPieceType(char: string): PieceType {
  switch (char) {
    case 'p':
      return 'pawn';
    case 'n':
      return 'knight';
    case 'b':
      return 'bishop';
    case 'r':
      return 'rook';
    case 'q':
      return 'queen';
    case 'k':
      return 'king';
    default:
      throw new Error(`Invalid piece character in FEN: ${char}`);
  }
}

/**
 * Parse castling rights from FEN
 */
function parseCastlingRights(castlingPart: string): { [key: string]: boolean } {
  const castlingRights: { [key: string]: boolean } = {
    'white-king': false,
    'white-rook-right': false,
    'white-rook-left': false,
    'black-king': false,
    'black-rook-right': false,
    'black-rook-left': false
  };
  
  // If castling is not available for any side
  if (castlingPart === '-') {
    return castlingRights;
  }
  
  // Parse each castling right
  // Note that in our implementation, castlingRights being true means the piece has moved
  // which is the inverse of the FEN notation where a letter means castling is available
  if (!castlingPart.includes('K')) {
    castlingRights['white-king'] = true;
    castlingRights['white-rook-right'] = true;
  }
  
  if (!castlingPart.includes('Q')) {
    castlingRights['white-king'] = true;
    castlingRights['white-rook-left'] = true;
  }
  
  if (!castlingPart.includes('k')) {
    castlingRights['black-king'] = true;
    castlingRights['black-rook-right'] = true;
  }
  
  if (!castlingPart.includes('q')) {
    castlingRights['black-king'] = true;
    castlingRights['black-rook-left'] = true;
  }
  
  return castlingRights;
}

/**
 * Parse en passant target from FEN
 */
function parseEnPassantTarget(enPassantPart: string): Position | null {
  if (enPassantPart === '-') {
    return null;
  }
  
  const file = enPassantPart.charAt(0);
  const rank = enPassantPart.charAt(1);
  
  if (file < 'a' || file > 'h' || rank < '1' || rank > '8') {
    throw new Error(`Invalid en passant target in FEN: ${enPassantPart}`);
  }
  
  const col = file.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const row = 8 - parseInt(rank); // '1' -> 7, '8' -> 0
  
  return { row, col };
}