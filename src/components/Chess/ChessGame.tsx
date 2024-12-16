'use client';

import React from 'react';
import Image from 'next/image';
import { useState } from 'react';

// Types and Interfaces
type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type PieceColor = 'white' | 'black';
type PieceSounds = {
  [K in PieceType]?: string;
};

type ColorSounds = {
  [K in PieceColor]: PieceSounds;
};

interface ChessPiece {
  type: PieceType;
  color: PieceColor;
}

interface Position {
  row: number;
  col: number;
}
interface SoundMap {
  check: string;
  invalid: string;
  move: string;
  capture: string;
  pieces: ColorSounds;
}

function deepCloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map(row => 
      row.map(piece => 
          piece ? { ...piece } : null
      )
  );
}

  // Piece display
  function getPieceSymbol(piece: ChessPiece): string {
    return `/pieces/${piece.color}-${piece.type}.png`;
  }
  function PromotionDialog({ pawn, onSelect }: {
    pawn: { position: Position; color: PieceColor };
    onSelect: (pieceType: PieceType) => void;
  }) {
    const promotionPieces: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];
    
    return (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                      bg-white shadow-lg rounded-lg p-6 border-2 border-gray-800">
        <div className="text-lg mb-4 text-black">Choose promotion piece:</div>
        <div className="flex gap-6">
          {promotionPieces.map(pieceType => (
            <div
              key={pieceType}
              className="cursor-pointer hover:bg-blue-100 p-3 rounded
                        flex items-center justify-center
                        text-4xl border-2 border-gray-300 relative w-24 h-24"
              onClick={() => onSelect(pieceType)}
            >
              <div className="relative w-[95%] h-[95%]">
                <Image
                  src={getPieceSymbol({ type: pieceType, color: pawn.color })}
                  alt={`${pawn.color} ${pieceType}`}
                  fill
                  sizes="96px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const soundMap: SoundMap = {
    check: '/sounds/check.mp3',
    invalid: '/sounds/invalid.mp3',
    move: '/sounds/move.mp3',
    capture: '/sounds/capture.mp3',
    pieces: {
      black: {
        pawn: '/sounds/pieces/black/pawn.mp3'
      },
      white: {
        pawn: '/sounds/pieces/white/pawn.mp3'
      }
    }
  };
  
  const playSound = (type: 'move' | 'capture' | 'check' | 'invalid', piece?: ChessPiece) => {
    if (typeof window === 'undefined') return;
  
    try {
      let soundPath: string;
      
      if (piece && (type === 'move' || type === 'capture')) {
        // Play piece-specific sound if it exists
        const pieceSound = soundMap.pieces[piece.color]?.[piece.type];
        soundPath = pieceSound || soundMap[type];
      } else {
        soundPath = soundMap[type];
      }
  
      const audio = new Audio(soundPath);
      audio.play().catch(err => console.log('Sound play error:', err));
    } catch (err) {
      console.log('Sound creation error:', err);
    }
  };

// First, let's add a CSS class for the rune effects
const runeOverlays = {
  normal: "ᛗ", // Mannaz - represents movement
  capture: "ᚦ", // Thurisaz - represents conflict/combat
  castle: "ᛒ", // Berkana - represents protection/defense
  enPassant: "ᛉ" // Algiz - represents opportunity
};

const ChessGame = () => {

  // Check if a king is in check
  function isInCheck(color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean {
    console.log(`\n--- Checking if ${color} is in check ---`);
    const kingPos = findKingOnBoard(color, checkBoard);
    console.log('King position:', kingPos);
    if (!kingPos) return false;
    
    return isSquareUnderAttack(kingPos, color, true, checkBoard);
}
// Helper function to find king on a specific board
function findKingOnBoard(color: PieceColor, checkBoard: (ChessPiece | null)[][]): Position | null {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = checkBoard[row][col];
            if (piece?.type === 'king' && piece.color === color) {
                return { row, col };
            }
        }
    }
    return null;
}

function wouldBeInCheck(from: Position, to: Position, color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean {
  console.log(`\n--- Would ${color} be in check after move from ${from.row},${from.col} to ${to.row},${to.col} ---`);
  console.log('\n---Move Analysis---');
  console.log(`Checking move from ${from.row},${from.col} to ${to.row},${to.col} for ${color}`);
  
  const testBoard = deepCloneBoard(checkBoard);  // Use passed in checkBoard instead of global board
  const movingPiece = testBoard[from.row][from.col];
  console.log('Moving piece:', movingPiece?.type);
  
  // Log initial board state
  console.log('Initial board state:');
  testBoard.forEach(row => {
      console.log(row.map(p => p ? `${p.color[0]}${p.type[0]}` : '--').join(' '));
  });
  
  testBoard[to.row][to.col] = movingPiece;
  testBoard[from.row][from.col] = null;
  
  const kingPos = movingPiece?.type === 'king' ? 
      to : findKingOnBoard(color, testBoard);
  console.log('King position:', kingPos);
  
  // Log board state after move
  console.log('Board state after move:');
  testBoard.forEach(row => {
      console.log(row.map(p => p ? `${p.color[0]}${p.type[0]}` : '--').join(' '));
  });
  
  if (!kingPos) return false;
  
  // Log attacking pieces and their moves
  for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
          const piece = testBoard[row][col];
          if (piece && piece.color !== color) {
              const moves = getBasicMoves(piece, { row, col }, testBoard);
              if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
                  console.log(`King in check from ${piece.color} ${piece.type} at ${row},${col}`);
                  return true;
              }
          }
      }
  }
  console.log('Move is safe - king not in check');
  return false;
}
  function isInCheckmate(color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean {
    const kingPos = findKingOnBoard(color, checkBoard);
    if (!kingPos) return false;
    

    const isCurrentlyInCheck = wouldBeInCheck(kingPos, kingPos, color, checkBoard);
    if (!isCurrentlyInCheck) return false;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = checkBoard[row][col];
            if (piece && piece.color === color) {
                const moves = getValidMoves(piece, { row, col }, checkBoard);
                for (const move of moves) {
                    const testBoard = deepCloneBoard(checkBoard);
                    testBoard[move.row][move.col] = piece;
                    testBoard[row][col] = null;
                    
                    // Fix: Handle potential null kingPos
                    const kingPos = piece.type === 'king' ? 
                        move : findKingOnBoard(color, testBoard);
                        
                    if (!kingPos) continue;  // Skip this move if we can't find the king
                    
                    let stillInCheck = false;
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            const attackingPiece = testBoard[r][c];
                            if (attackingPiece && attackingPiece.color !== color) {
                                const attackingMoves = getBasicMoves(attackingPiece, { row: r, col: c }, testBoard);
                                if (attackingMoves.some(m => m.row === kingPos.row && m.col === kingPos.col)) {
                                    stillInCheck = true;
                                    break;
                                }
                            }
                        }
                        if (stillInCheck) break;
                    }
                    if (!stillInCheck) return false;
                }
            }
        }
    }
    return true;
}
    function getBasicMoves(piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] {
      const moves: Position[] = [];
      const isInBounds = (row: number, col: number) => 
          row >= 0 && row < 8 && col >= 0 && col < 8;
  
      switch (piece.type) {
          case 'pawn': {
              const direction = piece.color === 'white' ? -1 : 1;
              const startRow = piece.color === 'white' ? 6 : 1;
              
              // Use checkBoard instead of board
              if (isInBounds(pos.row + direction, pos.col) && 
                  !checkBoard[pos.row + direction][pos.col]) {
                  moves.push({ row: pos.row + direction, col: pos.col });
                  
                  if (pos.row === startRow && !checkBoard[pos.row + 2 * direction][pos.col]) {
                      moves.push({ row: pos.row + 2 * direction, col: pos.col });
                  }
              }
              
              [-1, 1].forEach(offset => {
                  const newRow = pos.row + direction;
                  const newCol = pos.col + offset;
                  if (isInBounds(newRow, newCol)) {
                      // Use checkBoard instead of board
                      const targetPiece = checkBoard[newRow][newCol];
                      if (targetPiece && targetPiece.color !== piece.color) {
                          moves.push({ row: newRow, col: newCol });
                      }
                  }
              });
              break;
      }
       // Copy 
       case 'knight': {
        const knightMoves = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        knightMoves.forEach(([rowDelta, colDelta]) => {
          const newRow = pos.row + rowDelta;
          const newCol = pos.col + colDelta;
          if (isInBounds(newRow, newCol)) {
            const targetPiece = checkBoard[newRow][newCol];
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push({ row: newRow, col: newCol });
            }
          }
        });
        break;
      }
  
      case 'king': {
        const kingMoves = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1], [0, 1],
          [1, -1], [1, 0], [1, 1]
        ];
        kingMoves.forEach(([rowDelta, colDelta]) => {
          const newRow = pos.row + rowDelta;
          const newCol = pos.col + colDelta;
          if (isInBounds(newRow, newCol)) {
            const targetPiece = checkBoard[newRow][newCol];
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push({ row: newRow, col: newCol });
            }
          }
        });
        break;
      }
  
      case 'queen':
      case 'rook':
      case 'bishop': {
        const directions = piece.type === 'rook' 
          ? [[0, 1], [0, -1], [1, 0], [-1, 0]]
          : piece.type === 'bishop'
          ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
          : [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  
        directions.forEach(([rowDelta, colDelta]) => {
          let newRow = pos.row + rowDelta;
          let newCol = pos.col + colDelta;
          
          while (isInBounds(newRow, newCol)) {
            const targetPiece = checkBoard[newRow][newCol];
            if (!targetPiece) {
              moves.push({ row: newRow, col: newCol });
            } else {
              if (targetPiece.color !== piece.color) {
                moves.push({ row: newRow, col: newCol });
              }
              break;
            }
            newRow += rowDelta;
            newCol += colDelta;
          }
        });
        break;
      }
    }
  
    return moves;
  }
  function isSquareUnderAttack(pos: Position, defenderColor: PieceColor, ignoreCastling: boolean = false, checkBoard: (ChessPiece | null)[][] = board): boolean {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = checkBoard[row][col];  // CHANGED: board -> checkBoard
            if (piece && piece.color !== defenderColor) {
                const moves = ignoreCastling ? 
                    getBasicMoves(piece, { row, col }, checkBoard) : 
                    getValidMoves(piece, { row, col }, checkBoard);
                if (moves.some(move => move.row === pos.row && move.col === pos.col)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getEnPassantMoves(piece: ChessPiece, pos: Position): Position[] {
  const moves: Position[] = [];
  if (piece.type === 'pawn' && enPassantTarget) {
    // Check if pawn is in correct row for en passant
    if (pos.row === (piece.color === 'white' ? 3 : 4)) {
      // Check if pawn is adjacent to the target column
      if (Math.abs(pos.col - enPassantTarget.col) === 1) {
        moves.push({
          row: pos.row + (piece.color === 'white' ? -1 : 1),
          col: enPassantTarget.col
        });
      }
    }
  }
  return moves;
}
function getCastlingMoves(piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] {
  const moves: Position[] = [];
  if (
    piece.type === 'king' && 
    !hasMoved[`${piece.color}-king`] &&
    !isSquareUnderAttack(pos, piece.color, true)  // Pass true here
  ) {
    const row = piece.color === 'white' ? 7 : 0;
    
    // Kingside castling
    if (!hasMoved[`${piece.color}-rook-right`]) {
      if (
        !checkBoard[row][5] && !checkBoard[row][6] && // Squares must be empty
        !isSquareUnderAttack({ row, col: 5 }, piece.color) &&
        !isSquareUnderAttack({ row, col: 6 }, piece.color)
      ) {
        moves.push({ row, col: 6 });
      }
    }
    
    // Queenside castling
    if (!hasMoved[`${piece.color}-rook-left`]) {
      if (
        !checkBoard[row][1] && !checkBoard[row][2] && !checkBoard[row][3] && // Squares must be empty
        !isSquareUnderAttack({ row, col: 2 }, piece.color) &&
        !isSquareUnderAttack({ row, col: 3 }, piece.color)
      ) {
        moves.push({ row, col: 2 });
      }
    }
  }
  return moves;
}



  // Core state
  const [board, setBoard] = useState<(ChessPiece | null)[][]>(initializeBoard());
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>('white');
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [hasMoved, setHasMoved] = useState<{[key: string]: boolean}>({});
const [enPassantTarget, setEnPassantTarget] = useState<Position | null>(null);
const [promotionPawn, setPromotionPawn] = useState<{
  position: Position;
  color: PieceColor;
} | null>(null);
  const [gameState, setGameState] = useState<{
    isOver: boolean;
    winner: PieceColor | null;
    message: string;
  }>({
    isOver: false,
    winner: null,
    message: ''
  });
  const getRuneForMove = (rowIndex: number, colIndex: number) => {
    if (!selectedPiece) return null;
    
    const isValidMove = validMoves.find(
      move => move.row === rowIndex && move.col === colIndex
    );
    
    if (!isValidMove) return null;
    const targetPiece = board[rowIndex][colIndex];
    if (targetPiece) return runeOverlays.capture;
    
    // Check for castling
    const movingPiece = board[selectedPiece.row][selectedPiece.col];
    if (movingPiece?.type === 'king' && Math.abs(colIndex - selectedPiece.col) === 2) {
      return runeOverlays.castle;
    }
    
    // Check for en passant
    if (movingPiece?.type === 'pawn' && 
        enPassantTarget?.row === rowIndex && 
        enPassantTarget?.col === colIndex) {
      return runeOverlays.enPassant;
    }
    
    return runeOverlays.normal;
  };

  // Initialize board
  function initializeBoard(): (ChessPiece | null)[][] {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Setup pawns
    for (let i = 0; i < 8; i++) {
      board[1][i] = { type: 'pawn', color: 'black' };
      board[6][i] = { type: 'pawn', color: 'white' };
    }
    
    // Setup back rows
    const backRow: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let i = 0; i < 8; i++) {
      board[0][i] = { type: backRow[i], color: 'black' };
      board[7][i] = { type: backRow[i], color: 'white' };
    }
    
    return board;
  }

  // Core move validation
  function getValidMoves(piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] {
    const moves: Position[] = [];
    const isInBounds = (row: number, col: number) => 
      row >= 0 && row < 8 && col >= 0 && col < 8;

    switch (piece.type) {
      case 'pawn': {
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        // Forward move
        if (isInBounds(pos.row + direction, pos.col) && 
            !checkBoard[pos.row + direction][pos.col]) {
          moves.push({ row: pos.row + direction, col: pos.col });
          
          // Initial double move
          if (pos.row === startRow && !checkBoard[pos.row + 2 * direction][pos.col]) {  // CHANGED: board -> checkBoard
            moves.push({ row: pos.row + 2 * direction, col: pos.col });
        
          }
        }
        
        // Captures
        [-1, 1].forEach(offset => {
        const newRow = pos.row + direction;
        const newCol = pos.col + offset;
        if (isInBounds(newRow, newCol)) {
          const targetPiece = checkBoard[newRow][newCol];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push({ row: newRow, col: newCol });
          }
        }
      });
      break;
    }
    // Copy 
      case 'knight': {
        const knightMoves = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        knightMoves.forEach(([rowDelta, colDelta]) => {
          const newRow = pos.row + rowDelta;
          const newCol = pos.col + colDelta;
          if (isInBounds(newRow, newCol)) {
            const targetPiece = checkBoard[newRow][newCol];
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push({ row: newRow, col: newCol });
            }
          }
        });
        break;
      }

      case 'king': {
        const kingMoves = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1], [0, 1],
          [1, -1], [1, 0], [1, 1]
        ];
        kingMoves.forEach(([rowDelta, colDelta]) => {
          const newRow = pos.row + rowDelta;
          const newCol = pos.col + colDelta;
          if (isInBounds(newRow, newCol)) {
            const targetPiece = checkBoard[newRow][newCol];
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push({ row: newRow, col: newCol });
            }
          }
        });
        break;
      }

      case 'queen':
      case 'rook':
      case 'bishop': {
        const directions = piece.type === 'rook' 
          ? [[0, 1], [0, -1], [1, 0], [-1, 0]]
          : piece.type === 'bishop'
          ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
          : [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];

        directions.forEach(([rowDelta, colDelta]) => {
          let newRow = pos.row + rowDelta;
          let newCol = pos.col + colDelta;
          
          while (isInBounds(newRow, newCol)) {
            const targetPiece = checkBoard[newRow][newCol];
            if (!targetPiece) {
              moves.push({ row: newRow, col: newCol });
            } else {
              if (targetPiece.color !== piece.color) {
                moves.push({ row: newRow, col: newCol });
              }
              break;
            }
            newRow += rowDelta;
            newCol += colDelta;
          }
        });
        break;
      }
    }
    // Add special moves
if (piece.type === 'pawn') {
  moves.push(...getEnPassantMoves(piece, pos));
}
if (piece.type === 'king') {
  moves.push(...getCastlingMoves(piece, pos));
}
    
    return moves;
  }

  function isStalemate(color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean {
    // Find king's current position
    const kingPos = findKingOnBoard(color, checkBoard);
    if (!kingPos) return false;

    // If the king is in check, it's not stalemate
    const isCurrentlyInCheck = wouldBeInCheck(kingPos, kingPos, color, checkBoard);
    if (isCurrentlyInCheck) return false;
    // ... rest of stalemate logic
  
    // Check if any piece has any legal moves
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = checkBoard[row][col];  // Changed from board to checkBoard
            if (piece && piece.color === color) {
                const moves = getValidMoves(piece, { row, col }, checkBoard);  // Pass checkBoard
                for (const move of moves) {
                    // Check if this move would be legal (wouldn't put/leave king in check)
                    if (!wouldBeInCheck({ row, col }, move, color, checkBoard)) {
                        return false;  // Found a legal move, not stalemate
                    }
                }
            }
        }
    }
    
    // No legal moves found
    return true;
}
  function handlePromotion(pieceType: PieceType) {
    if (!promotionPawn) return;
    
    const newBoard = deepCloneBoard(board);
    
    // Clear any existing pieces at the promotion square
    newBoard[promotionPawn.position.row][promotionPawn.position.col] = null;
    
    // Add the new promoted piece
    newBoard[promotionPawn.position.row][promotionPawn.position.col] = {
      type: pieceType,
      color: promotionPawn.color
    };
    
    // Log the board state to help debug
    console.log('Board state after promotion:', newBoard);
    
    setBoard(newBoard);
    setPromotionPawn(null);
    setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
    
    // Check game state after promotion
    const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
 // Check game state using the new board BEFORE updating any state
const kingPos = findKingOnBoard(nextPlayer, newBoard);
if (kingPos) {
    const wouldBeInCheckResult = wouldBeInCheck(
        kingPos,
        kingPos,  // Same position since we're checking current state
        nextPlayer,
        newBoard
    );

    if (wouldBeInCheckResult) {
        if (isInCheckmate(nextPlayer, newBoard)) {
            setGameState({
                isOver: true,
                winner: currentPlayer,
                message: `Checkmate! ${currentPlayer} wins!`
            });
        } else {
            setGameState({
                ...gameState,
                message: `${nextPlayer} is in check!`
            });
        }
    }
} else if (isStalemate(nextPlayer)) {
      setGameState({
        isOver: true,
        winner: null,
        message: "Stalemate! Game is a draw!"
      });
}}

  // Handle square clicks
  function handleSquareClick(row: number, col: number) {
    const checkBoard = deepCloneBoard(board);
    const piece = checkBoard[row][col];
    
    if (selectedPiece) {
      const isValidMove = validMoves.some(
        move => move.row === row && move.col === col
      );

      if (isValidMove) {
        const wouldBeInCheckResult = wouldBeInCheck(
            { row: selectedPiece.row, col: selectedPiece.col },
            { row, col },
            currentPlayer, checkBoard
        );
        console.log('Would be in check:', wouldBeInCheckResult);
        
        if (wouldBeInCheckResult) {
          playSound('invalid');
          return;
        }
        const newBoard = deepCloneBoard(board);
        const movingPiece = newBoard[selectedPiece.row][selectedPiece.col]!;
        const isCapture = board[row][col] !== null;
       // In your move handling code where you call playSound
if (isCapture) {
  playSound('capture', movingPiece);
} else {
  playSound('move', movingPiece);
}
        
        // Handle special moves
        if (movingPiece.type === 'king') {
          // Castling
          if (Math.abs(col - selectedPiece.col) === 2) {
            const isKingside = col > selectedPiece.col;
            const rookCol = isKingside ? 7 : 0;
            const newRookCol = isKingside ? 5 : 3;
            
            newBoard[row][col] = movingPiece;
            newBoard[selectedPiece.row][selectedPiece.col] = null;
            
            // Move the rook
            newBoard[row][newRookCol] = newBoard[row][rookCol];
            newBoard[row][rookCol] = null;
            
            setHasMoved({
              ...hasMoved,
              [`${movingPiece.color}-king`]: true,
              [`${movingPiece.color}-rook-${isKingside ? 'right' : 'left'}`]: true
            });
          } else {
            // Normal king move
            newBoard[row][col] = movingPiece;
            newBoard[selectedPiece.row][selectedPiece.col] = null;
          }
        } else if (movingPiece.type === 'pawn') {
          // En passant capture
          if (
            enPassantTarget &&
            col === enPassantTarget.col &&
            row === (movingPiece.color === 'white' ? enPassantTarget.row - 1 : enPassantTarget.row + 1)
          ) {
            newBoard[enPassantTarget.row][enPassantTarget.col] = null;
          }
          if (row === 0 || row === 7) {
            newBoard[selectedPiece.row][selectedPiece.col] = null;  // Add this line
            setPromotionPawn({
              position: { row, col },
              color: movingPiece.color
            });
            setBoard(newBoard);  // Add this line
            return; // Wait for piece selection
          }
          
          // Make the normal move
          newBoard[row][col] = movingPiece;
          newBoard[selectedPiece.row][selectedPiece.col] = null;
          
          // Set en passant target if pawn moves two squares
          if (Math.abs(row - selectedPiece.row) === 2) {
            setEnPassantTarget({
              row: (row + selectedPiece.row) / 2,
              col
            });
          } else {
            setEnPassantTarget(null);
          }
        } else {
          // Normal piece move
          newBoard[row][col] = movingPiece;
          newBoard[selectedPiece.row][selectedPiece.col] = null;
        }
      
        // Track first moves for castling
        if (movingPiece.type === 'king' || movingPiece.type === 'rook') {
          const piece = movingPiece.type === 'king' ? 'king' : 
            `rook-${selectedPiece.col === 0 ? 'left' : 'right'}`;
          setHasMoved({
            ...hasMoved,
            [`${movingPiece.color}-${piece}`]: true
          });
        }
      
        // After all moves are made on newBoard (after castling, en passant, etc.)
const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';

// Run ALL checks on the final board state
const nextPlayerKingPos = findKingOnBoard(nextPlayer, newBoard);
if (nextPlayerKingPos && isInCheck(nextPlayer, newBoard)) {
  playSound('check');
    if (isInCheckmate(nextPlayer, newBoard)) {
        setGameState({
            isOver: true,
            winner: currentPlayer,
            message: `Checkmate! ${currentPlayer} wins!`
        });
    } else {
        setGameState({
            ...gameState,
            message: `${nextPlayer} is in check!`
        });
    }
} else if (isStalemate(nextPlayer, newBoard)) {
    setGameState({
        isOver: true,
        winner: null,
        message: "Stalemate! Game is a draw!"
    });
} else {
    setGameState({
        ...gameState,
        message: ''
    });
}

// Only after all checks, update the game state
setBoard(newBoard);
setCurrentPlayer(nextPlayer);
setSelectedPiece(null);
setValidMoves([]);

 
     
      } else if (piece?.color === currentPlayer) {
        setSelectedPiece({ row, col });
        setValidMoves(getValidMoves(piece, { row, col }));
      } else {
        setSelectedPiece(null);
        setValidMoves([]);
      }
    } else if (piece?.color === currentPlayer) {
      setSelectedPiece({ row, col });
      setValidMoves(getValidMoves(piece, { row, col }));
    }
  }
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-gray-900 p-4">
      <div className="w-full max-w-[min(75vh,750px)] aspect-square flex flex-col">
        <div className="bg-gray-800 shadow-2xl rounded-lg p-3 border-2 border-amber-600 flex-1 flex flex-col">
          <h1 className="text-4xl font-bold mb-4 text-center text-amber-400" style={{ fontFamily: 'Marker Felt, Comic Sans MS, cursive' }}>
            New Asgard Chess
          </h1>
          
          <div className="mb-4 bg-gray-900/50 p-2 rounded-lg border border-amber-600/20">
            {gameState.isOver ? (
              <div className="text-xl font-bold text-amber-400 text-center">
                {gameState.message}
              </div>
            ) : (
              <div className="text-center">
                <span className="text-amber-400 font-bold">Current Player: </span>
                <span className="text-amber-400">{currentPlayer}</span>
                {gameState.message && (
                  <span className="text-red-500 ml-2 font-bold">
                    {gameState.message}
                  </span>
                )}
              </div>
            )}
          </div>
  
          <div className="flex-1 grid grid-cols-8 gap-0 border-2 border-amber-600 rounded-lg overflow-hidden bg-amber-800">
            {board.map((row, rowIndex) => 
              row.map((piece, colIndex) => {
                const isLight = (rowIndex + colIndex) % 2 === 0;
                const isSelected = selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex;
                
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`
                      aspect-square relative
                      ${isLight ? 'bg-amber-200' : 'bg-amber-800'}
                      ${isLight ? 'hover:bg-amber-100' : 'hover:bg-amber-700'}
                      ${isSelected ? 'ring-2 ring-amber-400' : ''}
                      transition-colors duration-200
                    `}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                    >
                      {getRuneForMove(rowIndex, colIndex) && (
                        <div className={`
                          absolute inset-0 flex items-center justify-center
                          text-4xl rune-style pointer-events-none rune-pulse
                          ${isLight ? 'text-amber-900/70' : 'text-amber-100/70'}
                          font-bold z-10
                        `}>
                          {getRuneForMove(rowIndex, colIndex)}
                        </div>
                      )}
                      {piece && (
                   <div className="absolute inset-0 flex items-center justify-center">
                   <div className="relative w-[95%] h-[95%]">
                     <Image 
                       src={getPieceSymbol(piece)}
                       alt={`${piece.color} ${piece.type}`}
                       fill
                       sizes="(max-width: 768px) 12vw, (max-width: 1024px) 8vw, 6vw"
                       className="object-contain pointer-events-none"
                       priority={piece.type === 'king' || piece.type === 'queen' || rowIndex <= 1 || rowIndex >= 6}
                     />
                   </div>
                 </div>
                      )}
                  </div>
                );
              })
            )}
          </div>
  
          <div className="mt-4 flex justify-center">
            <button 
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg 
                         transition-colors duration-200 shadow-lg hover:shadow-xl"
              onClick={() => {
                setBoard(initializeBoard());
                setCurrentPlayer('white');
                setSelectedPiece(null);
                setValidMoves([]);
                setGameState({
                  isOver: false,
                  winner: null,
                  message: ''
                });
                setHasMoved({});
                setEnPassantTarget(null);
                setPromotionPawn(null);
              }}
            >
              New Game
            </button>
          </div>
        </div>
        
        {promotionPawn && (
          <PromotionDialog 
            pawn={promotionPawn} 
            onSelect={handlePromotion}
          />
        )}
      </div>
    </div>
  );
}
export default ChessGame;