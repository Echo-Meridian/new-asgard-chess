'use client';

/**
 * Modified ChessGame component with improved AI integration and draw detection
 */

import React from 'react';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import AIControls from './AIControls';
import { useChessAI } from '@/hooks/useChessAI';
import { playSound, SoundTypes } from '@/utils/soundUtils';
import type { ChessPiece, PieceColor, Position, PieceType } from '@/types/chess';

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


// Add this function to generate chess notation
const generateMoveNotation = (
  piece: ChessPiece, 
  from: Position, 
  to: Position, 
  isCapture: boolean
): string => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  const fromSquare = `${files[from.col]}${ranks[from.row]}`;
  const toSquare = `${files[to.col]}${ranks[to.row]}`;
  
  // Special case for castling
  if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
    return to.col > from.col ? 'O-O' : 'O-O-O';
  }
  
  let notation = '';
  
  // Add piece letter (except for pawns)
  if (piece.type !== 'pawn') {
    notation += piece.type === 'knight' ? 'N' : piece.type.charAt(0).toUpperCase();
  }
  
  // Add from file for pawns that capture
  if (piece.type === 'pawn' && isCapture) {
    notation += fromSquare[0]; // Use first character of fromSquare
  }
  
  // Add capture symbol
  if (isCapture) {
    notation += 'x';
  }
  
  // Add destination square
  notation += toSquare;
  
  return notation;
};

// First, let's add a CSS class for the rune effects
const runeOverlays = {
  normal: "ᛗ", // Mannaz - represents movement
  capture: "ᚦ", // Thurisaz - represents conflict/combat
  castle: "ᛒ", // Berkana - represents protection/defense
  enPassant: "ᛉ" // Algiz - represents opportunity
};

const ChessGame = () => {
  // Core state
  const [board, setBoard] = useState<(ChessPiece | null)[][]>(initializeBoard());
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>('white');
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [hasMoved, setHasMoved] = useState<{[key: string]: boolean}>({});
  const [showInfo, setShowInfo] = useState(false);
  const [enPassantTarget, setEnPassantTarget] = useState<Position | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [showMoveHistory, setShowMoveHistory] = useState(false);
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
  
  // Draw detection state
  const [halfMoveCount, setHalfMoveCount] = useState<number>(0); // For 50-move rule
  const [boardPositions, setBoardPositions] = useState<string[]>([]); // For three-fold repetition
  
  // AI state
  const [isAIEnabled, setAIEnabled] = useState(false);
  const [isAIThinking, setAIThinking] = useState(false);
  
  // Initialize AI
  const { 
    getAIMove, 
    getHint,
    loading: aiLoading
  } = useChessAI({ autoInit: true });
  
  // Check if a king is in check
  function isInCheck(color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean {
    const kingPos = findKingOnBoard(color, checkBoard);
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
    const testBoard = deepCloneBoard(checkBoard);
    const movingPiece = testBoard[from.row][from.col];
    
    testBoard[to.row][to.col] = movingPiece;
    testBoard[from.row][from.col] = null;
    
    const kingPos = movingPiece?.type === 'king' ? 
      to : findKingOnBoard(color, testBoard);
    
    if (!kingPos) return false;
    
    // Check if any opponent piece can attack the king
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = testBoard[row][col];
        if (piece && piece.color !== color) {
          const moves = getBasicMoves(piece, { row, col }, testBoard);
          if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  function isInCheckmate(color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean {
    // If not in check, cannot be checkmate
    if (!isInCheck(color, checkBoard)) return false;
    
    // Check if any move can get out of check
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = checkBoard[row][col];
        if (piece && piece.color === color) {
          const moves = getValidMoves(piece, { row, col }, checkBoard);
          
          for (const move of moves) {
            // Try the move and see if it gets out of check
            const testBoard = deepCloneBoard(checkBoard);
            testBoard[move.row][move.col] = piece;
            testBoard[row][col] = null;
            
            if (!isInCheck(color, testBoard)) {
              return false; // Found a legal move
            }
          }
        }
      }
    }
    
    return true; // No legal moves found
  }
  
  function getBasicMoves(piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] {
    const moves: Position[] = [];
    const isInBounds = (row: number, col: number) => 
      row >= 0 && row < 8 && col >= 0 && col < 8;
  
    switch (piece.type) {
      case 'pawn': {
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
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
            const targetPiece = checkBoard[newRow][newCol];
            if (targetPiece && targetPiece.color !== piece.color) {
              moves.push({ row: newRow, col: newCol });
            }
          }
        });
        break;
      }
      // Knight
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
        const piece = checkBoard[row][col];
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
      !isSquareUnderAttack(pos, piece.color, true, checkBoard)
    ) {
      const row = piece.color === 'white' ? 7 : 0;
      
      // Kingside castling
      if (!hasMoved[`${piece.color}-rook-right`]) {
        if (
          !checkBoard[row][5] && !checkBoard[row][6] && // Squares must be empty
          !isSquareUnderAttack({ row, col: 5 }, piece.color, true, checkBoard) &&
          !isSquareUnderAttack({ row, col: 6 }, piece.color, true, checkBoard)
        ) {
          moves.push({ row, col: 6 });
        }
      }
      
      // Queenside castling
      if (!hasMoved[`${piece.color}-rook-left`]) {
        if (
          !checkBoard[row][1] && !checkBoard[row][2] && !checkBoard[row][3] && // Squares must be empty
          !isSquareUnderAttack({ row, col: 2 }, piece.color, true, checkBoard) &&
          !isSquareUnderAttack({ row, col: 3 }, piece.color, true, checkBoard)
        ) {
          moves.push({ row, col: 2 });
        }
      }
    }
    return moves;
  }

  // Get the rune to display for a valid move
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
    // Get all possible moves without considering check
    const moves = getBasicMoves(piece, pos, checkBoard);
    
    // Add special moves
    if (piece.type === 'pawn') {
      moves.push(...getEnPassantMoves(piece, pos));
    }
    if (piece.type === 'king') {
      moves.push(...getCastlingMoves(piece, pos, checkBoard));
    }
    
    return moves;
  }

  function isStalemate(color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean {
    // Not in check, but no legal moves
    if (isInCheck(color, checkBoard)) return false;
    
    // Check if any piece has a legal move
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = checkBoard[row][col];
        if (piece && piece.color === color) {
          const moves = getValidMoves(piece, { row, col }, checkBoard);
          
          for (const move of moves) {
            if (!wouldBeInCheck({ row, col }, move, color, checkBoard)) {
              return false; // Found a legal move
            }
          }
        }
      }
    }
    
    return true; // No legal moves found
  }
  
  // Generate a unique representation of the current board position
  function generateBoardPosition(positionBoard: (ChessPiece | null)[][] = board, positionPlayer: PieceColor = currentPlayer): string {
    // Convert board to FEN-like notation for the position
    const position = positionBoard.map(row => 
      row.map(piece => {
        if (!piece) return '.';
        const letter = piece.type === 'knight' ? 'n' : piece.type[0];
        return piece.color === 'white' ? letter.toUpperCase() : letter;
      }).join('')
    ).join('/');
    
    // Also include current player and castling rights in the position
    const castlingOptions = 
      (!hasMoved['white-king'] && !hasMoved['white-rook-right'] ? 'K' : '') +
      (!hasMoved['white-king'] && !hasMoved['white-rook-left'] ? 'Q' : '') +
      (!hasMoved['black-king'] && !hasMoved['black-rook-right'] ? 'k' : '') +
      (!hasMoved['black-king'] && !hasMoved['black-rook-left'] ? 'q' : '');
    
    return `${position}|${positionPlayer}|${castlingOptions}`;
  }
  
  // Check for three-fold repetition
  function isThreefoldRepetition(): boolean {
    const currentPosition = generateBoardPosition();
    
    // Count occurrences of current position in history
    let occurrences = 1; // Current position counts as 1
    
    for (const position of boardPositions) {
      if (position === currentPosition) {
        occurrences++;
        if (occurrences >= 3) return true;
      }
    }
    
    return false;
  }
  
  // Check for 50-move rule
  function isFiftyMoveRule(): boolean {
    return halfMoveCount >= 100; // 50 moves = 100 half moves
  }
  
  // Check for any type of draw
  function isDraw(checkBoard: (ChessPiece | null)[][] = board, checkPlayer: PieceColor = currentPlayer): boolean {
    return (
      isStalemate(checkPlayer, checkBoard) ||
      isThreefoldRepetition() ||
      isFiftyMoveRule()
    );
  }
  
  function handlePromotion(pieceType: PieceType) {
    if (!promotionPawn) return;
    
    const newBoard = deepCloneBoard(board);
    
    // Add the new promoted piece
    newBoard[promotionPawn.position.row][promotionPawn.position.col] = {
      type: pieceType,
      color: promotionPawn.color
    };
    
    setBoard(newBoard);
    setPromotionPawn(null);
    
    // Reset half-move counter since pawn was moved
    setHalfMoveCount(0);
    
    // Add current position to history
    const currentPosition = generateBoardPosition(newBoard, currentPlayer === 'white' ? 'black' : 'white');
    setBoardPositions(prevPositions => [...prevPositions, currentPosition]);
    
    // Check game state after promotion
    const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
    
    if (isInCheck(nextPlayer, newBoard)) {
      playSound(SoundTypes.CHECK);
      
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
    } else if (isDraw(newBoard, nextPlayer)) {
      let drawMessage = "Draw!";
      
      if (isStalemate(nextPlayer, newBoard)) {
        drawMessage = "Stalemate! Game is a draw!";
      } else if (isThreefoldRepetition()) {
        drawMessage = "Draw by threefold repetition!";
      } else if (isFiftyMoveRule()) {
        drawMessage = "Draw by 50-move rule!";
      }
      
      setGameState({
        isOver: true,
        winner: null,
        message: drawMessage
      });
    }
    
    setCurrentPlayer(nextPlayer);
  }

  // Handle moving pieces
  const handleMove = useCallback((from: Position, to: Position) => {
    const piece = board[from.row][from.col];
    if (!piece) return;
    
    const isValidMove = getValidMoves(piece, from).some(
      move => move.row === to.row && move.col === to.col
    );
    
    if (!isValidMove || wouldBeInCheck(from, to, currentPlayer)) {
      playSound(SoundTypes.INVALID);
      return;
    }
    
    const newBoard = deepCloneBoard(board);
    const isCapture = board[to.row][to.col] !== null;
    const isPawnMove = piece.type === 'pawn';
    
    // Calculate new half-move count for 50-move rule
    // Reset on pawn moves or captures
    const newHalfMoveCount = isPawnMove || isCapture ? 0 : halfMoveCount + 1;
    setHalfMoveCount(newHalfMoveCount);
    
    // Handle the move
    if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
      // Castling
      const isKingside = to.col > from.col;
      const rookCol = isKingside ? 7 : 0;
      const newRookCol = isKingside ? 5 : 3;
      
      newBoard[to.row][to.col] = piece;
      newBoard[from.row][from.col] = null;
      
      // Move the rook
      newBoard[to.row][newRookCol] = newBoard[to.row][rookCol];
      newBoard[to.row][rookCol] = null;
      
      setHasMoved({
        ...hasMoved,
        [`${piece.color}-king`]: true,
        [`${piece.color}-rook-${isKingside ? 'right' : 'left'}`]: true
      });
      
      playSound(SoundTypes.MOVE);
    } else if (piece.type === 'pawn') {
      // En passant capture
      if (
        enPassantTarget &&
        to.col === enPassantTarget.col &&
        to.row === (piece.color === 'white' ? enPassantTarget.row - 1 : enPassantTarget.row + 1)
      ) {
        newBoard[enPassantTarget.row][enPassantTarget.col] = null;
        newBoard[to.row][to.col] = piece;
        newBoard[from.row][from.col] = null;
        playSound(SoundTypes.CAPTURE);
      } 
      // Promotion
      else if (to.row === 0 || to.row === 7) {
        newBoard[from.row][from.col] = null;
        setPromotionPawn({
          position: { row: to.row, col: to.col },
          color: piece.color
        });
        setBoard(newBoard);
        return;
      } 
      // Regular pawn move
      else {
        newBoard[to.row][to.col] = piece;
        newBoard[from.row][from.col] = null;
        
        if (isCapture) {
          playSound(SoundTypes.CAPTURE);
        } else {
          playSound(SoundTypes.MOVE);
        }
      }
      
      // Set en passant target if pawn moves two squares
      if (Math.abs(to.row - from.row) === 2) {
        setEnPassantTarget({
          row: (to.row + from.row) / 2,
          col: to.col
        });
      } else {
        setEnPassantTarget(null);
      }
    } 
    // Regular piece move
    else {
      newBoard[to.row][to.col] = piece;
      newBoard[from.row][from.col] = null;
      
      if (isCapture) {
        playSound(SoundTypes.CAPTURE);
      } else {
        playSound(SoundTypes.MOVE);
      }
    }
    
    // Track piece movements for castling
    if (piece.type === 'king' || piece.type === 'rook') {
      const pieceKey = piece.type === 'king' ? 'king' : 
        `rook-${from.col === 0 ? 'left' : 'right'}`;
      setHasMoved({
        ...hasMoved,
        [`${piece.color}-${pieceKey}`]: true
      });
    }
    
    // Add move to history
    const moveNotation = generateMoveNotation(piece, from, to, isCapture);
    setMoveHistory(prev => [...prev, moveNotation]);
    
    // Add current position to history for three-fold repetition detection
    const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
    const boardPosition = generateBoardPosition(newBoard, nextPlayer);
    setBoardPositions(prevPositions => [...prevPositions, boardPosition]);
    
    // Update board
    setBoard(newBoard);
    
    // Check for check/checkmate/stalemate
    if (isInCheck(nextPlayer, newBoard)) {
      playSound(SoundTypes.CHECK);
      
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
    } else if (isDraw(newBoard, nextPlayer)) {
      // Determine type of draw
      let drawMessage = "Draw!";
      
      if (isStalemate(nextPlayer, newBoard)) {
        drawMessage = "Stalemate! Game is a draw!";
      } else if (isThreefoldRepetition()) {
        drawMessage = "Draw by threefold repetition!";
      } else if (isFiftyMoveRule()) {
        drawMessage = "Draw by 50-move rule!";
      }
      
      setGameState({
        isOver: true,
        winner: null,
        message: drawMessage
      });
    } else {
      setGameState({ ...gameState, message: '' });
    }
    
    // Change turn
    setCurrentPlayer(nextPlayer);
    setSelectedPiece(null);
    setValidMoves([]);
  }, [board, currentPlayer, enPassantTarget, gameState, halfMoveCount, hasMoved]);
  
  // Effect to handle AI moves
  useEffect(() => {
    let isMounted = true;
    
    const makeAIMove = async () => {
      if (isAIEnabled && currentPlayer === 'black' && !gameState.isOver && !promotionPawn) {
        setAIThinking(true);
        try {
          // Wait a short delay to show the AI is "thinking"
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get AI move
          const move = await getAIMove(
            board, 
            currentPlayer, 
            hasMoved, 
            enPassantTarget
          );
          
          if (move && isMounted) {
            handleMove(move.from, move.to);
          }
        } catch (error) {
          console.error('AI move error:', error);
        } finally {
          if (isMounted) {
            setAIThinking(false);
          }
        }
      }
    };
    
    makeAIMove();
    
    return () => {
      isMounted = false;
    };
  }, [currentPlayer, isAIEnabled, gameState.isOver, promotionPawn, board, enPassantTarget, getAIMove, handleMove, hasMoved]);
  
  // Handle getting a hint from AI
  const handleGetHint = async () => {
    if (gameState.isOver || aiLoading) return;
    
    setAIThinking(true);
    try {
      const hintPosition = await getHint(board, currentPlayer);
      
      if (hintPosition) {
        // Highlight the square
        // This could be improved to show both source and target squares
        setValidMoves(prevMoves => [...prevMoves, hintPosition]);
        
        // Clear the hint after 2 seconds
        setTimeout(() => {
          setValidMoves([]);
        }, 2000);
      }
    } catch (error) {
      console.error('Hint error:', error);
    } finally {
      setAIThinking(false);
    }
  };
  
  // Handle square clicks
  function handleSquareClick(row: number, col: number) {
    if (gameState.isOver || isAIThinking || (currentPlayer === 'black' && isAIEnabled)) return;
    
    const piece = board[row][col];
    
    if (selectedPiece) {
      // If clicking on a destination square
      if (selectedPiece.row !== row || selectedPiece.col !== col) {
        handleMove(selectedPiece, { row, col });
      } 
      // If clicking on the selected piece again, deselect it
      else {
        setSelectedPiece(null);
        setValidMoves([]);
      }
    } 
    // Selecting a new piece
    else if (piece?.color === currentPlayer) {
      setSelectedPiece({ row, col });
      const legalMoves = getValidMoves(piece, { row, col }).filter(
        move => !wouldBeInCheck({ row, col }, move, currentPlayer)
      );
      setValidMoves(legalMoves);
    }
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] bg-gray-900 p-4">
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

          <div className="mt-4 flex justify-between items-center">
            <div className="flex gap-2">
              <button 
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg 
                          transition-colors duration-200 shadow-lg hover:shadow-xl"
                onClick={() => {
                  setMoveHistory([]);
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
                  setHalfMoveCount(0);
                  setBoardPositions([]);
                }}
              >
                New Game
              </button>
              
              <button 
                className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg 
                          transition-colors duration-200 shadow-lg hover:shadow-xl"
                onClick={() => setShowInfo(true)}
                aria-label="Game Information"
              >
                ℹ️
              </button>
              
              <button 
                className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg 
                          transition-colors duration-200 shadow-lg hover:shadow-xl"
                onClick={() => setShowMoveHistory(!showMoveHistory)}
                aria-label="Move History"
              >
                📜
              </button>
            </div>
            
            <AIControls
              onGetHint={handleGetHint}
              isAIEnabled={isAIEnabled}
              setAIEnabled={setAIEnabled}
              isAIThinking={isAIThinking}
            />
          </div>
        </div>
        
        {showMoveHistory && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40" 
              onClick={() => setShowMoveHistory(false)}>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-xs w-full border-2 border-amber-600 m-4" 
                onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-amber-400">Move History</h2>
                <button 
                  className="text-amber-400 hover:text-amber-300 text-xl font-bold"
                  onClick={() => setShowMoveHistory(false)}
                >
                  ✕
                </button>
              </div>
              
              {moveHistory.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 max-h-96 overflow-auto pr-2">
                {moveHistory.map((move, index) => (
                  <div key={index} 
                      className={`${index % 2 === 0 ? 'text-amber-300' : 'text-amber-100'} 
                                ${index === moveHistory.length - 1 || index === moveHistory.length - 2 ? 'font-bold text-amber-400' : ''}`}>
                    {index % 2 === 0 && (
                      <span className="font-medium text-amber-500 mr-1">{Math.floor(index/2) + 1}.</span>
                    )} {move}
                  </div>
                ))}
                </div>
              ) : (
                <div className="text-center text-amber-300 italic py-4">No moves yet</div>
              )}
              
              {moveHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-amber-700">
                  <div className="text-amber-400 font-bold">
                    Last Move: {moveHistory[moveHistory.length - 1]}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {showInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInfo(false)}>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md border-2 border-amber-600" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-amber-400 mb-4">New Asgard Chess</h2>
              <p className="text-gray-200 mb-4">
                A Norse-themed chess game for Sam&apos;s adventures in New Asgard.
              </p>
              <div className="text-sm text-gray-400 mb-4">
                Version 2.0.0
              </div>
              <div className="text-xs text-gray-500 mb-4 space-y-1">
                <div>Features:</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Play against Stockfish AI with multiple difficulty levels</li>
                  <li>Get AI hints for your next best move</li>
                  <li>Nordic rune effects for moves and special actions</li>
                  <li>Complete chess rules with castling, en passant, and promotion</li>
                  <li>Advanced draw detection (stalemate, threefold repetition, 50-move rule)</li>
                  <li>Mobile-friendly design with optimized sound handling</li>
                  <li>Full chess notation and game history tracking</li>
                </ul>
              </div>
              <p className="text-xs text-amber-400/80 mb-4 italic">
                &quot;The pieces move as if guided by the wisdom of Odin himself!&quot;
              </p>
              <button 
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg"
                onClick={() => setShowInfo(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        {promotionPawn && (
          <PromotionDialog 
            pawn={promotionPawn} 
            onSelect={handlePromotion}
          />
        )}
        
        {isAIThinking && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-amber-800 p-4 rounded-lg shadow-xl text-white animate-pulse">
              AI is thinking...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChessGame;