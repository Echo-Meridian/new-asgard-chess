'use client';

// Global error handler to catch any unhandled errors
if (typeof window !== 'undefined') {
  window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global error caught:', { message, source, lineno, colno, error });
    alert(`Global error: ${message}\nLine: ${lineno}\nColumn: ${colno}`);
    return true;
  };

  // Also catch unhandled promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled promise rejection:', event.reason);
    alert(`Unhandled promise rejection: ${event.reason}`);
  });
}

/* eslint-disable react-hooks/exhaustive-deps */
/**
 * ChessGame component with Stockfish AI integration and draw detection
 */

import React from 'react';
import Image from 'next/image';
import { useEffect, useCallback } from 'react';
import AIControls from './AIControls';
import { useChessAI } from '@/hooks/useChessAI';
import { useChessReducer } from '@/hooks/useChessReducer';
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
    <div className="bg-white shadow-lg rounded-lg p-6 border-2 border-amber-800 z-50 max-w-md">
      <div className="text-xl mb-4 text-black font-semibold">Choose promotion piece:</div>
      <div className="text-sm mb-4 text-gray-600">
        Game is paused until you select a piece for promotion
      </div>
      <div className="flex gap-6 flex-wrap justify-center">
        {promotionPieces.map(pieceType => (
          <div
            key={pieceType}
            className="cursor-pointer hover:bg-amber-100 p-3 rounded
                        flex flex-col items-center gap-1
                        text-4xl border-2 border-amber-300 hover:border-amber-500 
                        relative w-24 h-28 transition-colors"
            onClick={() => onSelect(pieceType)}
          >
            <div className="relative w-[95%] h-[75%]">
              <Image
                src={getPieceSymbol({ type: pieceType, color: pawn.color })}
                alt={`${pawn.color} ${pieceType}`}
                fill
                sizes="96px"
                className="object-contain"
                priority
              />
            </div>
            <div className="text-sm text-center text-gray-700 capitalize mt-1">
              {pieceType}
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
  // Use the reducer hook to manage all chess state
  const { state, actions } = useChessReducer();

  // Refs for storing abort controllers
  const aiMoveAbortController = React.useRef<AbortController | null>(null);
  const aiHintAbortController = React.useRef<AbortController | null>(null);

  // Destructure state for easier access in the component
  const {
    board,
    currentPlayer,
    selectedPiece,
    validMoves,
    hasMoved,
    showInfo,
    enPassantTarget,
    moveHistory,
    showMoveHistory,
    promotionPawn,
    gameState,
    halfMoveCount,
    boardPositions,
    isAIEnabled,
    isAIThinking,
    processingAction
  } = state;

  // Initialize AI
  const {
    getAIMove,
    getHint,
    loading: aiLoading,
    initialized: aiInitialized,
    error: aiError
  } = useChessAI({ autoInit: true });

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      // Abort any pending AI operations when component unmounts
      if (aiMoveAbortController.current) {
        console.log('Aborting AI move on unmount');
        aiMoveAbortController.current.abort();
        aiMoveAbortController.current = null;
      }
      if (aiHintAbortController.current) {
        console.log('Aborting hint request on unmount');
        aiHintAbortController.current.abort();
        aiHintAbortController.current = null;
      }
    };
  }, []);
  /**
    * Reset game state if it appears to be stuck
    */
  function resetGameState() {
    console.log("Attempting to reset stuck game state");

    // Force flags to their expected states
    if (processingAction) {
      console.log("Resetting processingAction flag");
      actions.setProcessing(false);
    }

    if (isAIThinking) {
      console.log("Resetting AI thinking flag");
      actions.setAIThinking(false);
    }

    // If there's a pending promotion, force it to complete
    if (promotionPawn) {
      console.log("Forcing promotion to queen to unblock game");
      actions.promotePawn('queen');
    }

    // Clear any selection state
    if (selectedPiece) {
      console.log("Clearing selected piece");
      actions.deselectPiece();
    }

    console.log("Game state has been reset");
  }


  // Log AI status for debugging - reduced frequency to prevent console spam
  const prevAIStatusRef = React.useRef<{
    initialized: boolean;
    loading: boolean;
    error: string | null;
    enabled: boolean;
  }>({ initialized: false, loading: false, error: null, enabled: false });

  // Track diagnostics for development/troubleshooting purposes
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);

  useEffect(() => {
    // Only log when status actually changes to reduce console noise
    const currentStatus = {
      initialized: aiInitialized,
      loading: aiLoading,
      error: aiError,
      enabled: isAIEnabled
    };

    const prevStatus = prevAIStatusRef.current;
    const hasChanged =
      prevStatus.initialized !== currentStatus.initialized ||
      prevStatus.loading !== currentStatus.loading ||
      prevStatus.error !== currentStatus.error ||
      prevStatus.enabled !== currentStatus.enabled;

    if (hasChanged) {
      console.log('AI Status changed:', currentStatus);
      prevAIStatusRef.current = { ...currentStatus };
    }
  }, [aiInitialized, aiLoading, aiError, isAIEnabled]);

  // A simplified test function to add to your ChessGame component
  async function testAI() {
    try {
      console.log("Testing AI availability");
      const worker = new Worker('/stockfish/stockfish.worker.js');

      worker.onmessage = (e) => {
        console.log("Worker response:", e.data);
      };

      worker.onerror = (err) => {
        console.error("Worker error:", err);
        alert("Stockfish worker error: " + err.message);
      };

      // Send a simple command
      worker.postMessage({ cmd: 'command', param: 'uci' });

      alert("Test command sent to worker");
    } catch (err) {
      console.error("AI test failed:", err);
      alert("AI test failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Helper function to detect if square is under attack - must be defined before isInCheck
  const checkSquareUnderAttack = (
    pos: Position,
    defenderColor: PieceColor,
    checkBoard: (ChessPiece | null)[][]
  ): boolean => {
    // Check for pawn attacks
    const pawnDirection = defenderColor === 'white' ? 1 : -1;
    for (const offset of [-1, 1]) {
      const attackRow = pos.row + pawnDirection;
      const attackCol = pos.col + offset;
      if (attackRow >= 0 && attackRow < 8 && attackCol >= 0 && attackCol < 8) {
        const attacker = checkBoard[attackRow][attackCol];
        if (attacker && attacker.color !== defenderColor && attacker.type === 'pawn') {
          return true;
        }
      }
    }

    // Check for knight attacks
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [rowOffset, colOffset] of knightOffsets) {
      const attackRow = pos.row + rowOffset;
      const attackCol = pos.col + colOffset;
      if (attackRow >= 0 && attackRow < 8 && attackCol >= 0 && attackCol < 8) {
        const attacker = checkBoard[attackRow][attackCol];
        if (attacker && attacker.color !== defenderColor && attacker.type === 'knight') {
          return true;
        }
      }
    }

    // Check for king attacks (needed for isSquareUnderAttack)
    const kingOffsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];
    for (const [rowOffset, colOffset] of kingOffsets) {
      const attackRow = pos.row + rowOffset;
      const attackCol = pos.col + colOffset;
      if (attackRow >= 0 && attackRow < 8 && attackCol >= 0 && attackCol < 8) {
        const attacker = checkBoard[attackRow][attackCol];
        if (attacker && attacker.color !== defenderColor && attacker.type === 'king') {
          return true;
        }
      }
    }

    // Check for attacks from sliding pieces (rook, bishop, queen)
    // Rook/Queen moves - horizontal and vertical
    const rookDirections = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [rowDelta, colDelta] of rookDirections) {
      let newRow = pos.row + rowDelta;
      let newCol = pos.col + colDelta;
      while (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const piece = checkBoard[newRow][newCol];
        if (piece) {
          if (piece.color !== defenderColor &&
            (piece.type === 'rook' || piece.type === 'queen')) {
            return true;
          }
          break; // Blocked by a piece
        }
        newRow += rowDelta;
        newCol += colDelta;
      }
    }

    // Bishop/Queen moves - diagonal
    const bishopDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [rowDelta, colDelta] of bishopDirections) {
      let newRow = pos.row + rowDelta;
      let newCol = pos.col + colDelta;
      while (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const piece = checkBoard[newRow][newCol];
        if (piece) {
          if (piece.color !== defenderColor &&
            (piece.type === 'bishop' || piece.type === 'queen')) {
            return true;
          }
          break; // Blocked by a piece
        }
        newRow += rowDelta;
        newCol += colDelta;
      }
    }

    return false;
  };

  // Check if a king is in check - independent implementation to avoid circular deps
  const isInCheck = useCallback((color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean => {
    // Find king position
    let kingPos: Position | null = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = checkBoard[row][col];
        if (piece?.type === 'king' && piece.color === color) {
          kingPos = { row, col };
          break;
        }
      }
      if (kingPos) break;
    }

    if (!kingPos) return false;

    // Check if king is under attack
    return checkSquareUnderAttack(kingPos, color, checkBoard);
  }, [board]);
  async function checkStockfishFiles() {
    const files = [
      '/stockfish/stockfish.js',
      '/stockfish/stockfish.worker.js',
      '/stockfish/stockfish.wasm'
    ];

    let results = '';

    for (const file of files) {
      try {
        const response = await fetch(file);
        const status = response.ok ? 'OK' : 'Not found (status: ' + response.status + ')';
        console.log(`${file}: ${status}`);
        results += `${file}: ${status}\n`;
      } catch (err) {
        console.error(`Error fetching ${file}:`, err);
        results += `${file}: Error - ${err instanceof Error ? err.message : String(err)}\n`;
      }
    }

    alert("File check results:\n" + results);
  }

  // Not needed anymore - we're using direct king finding in isInCheck

  // Simple version of getValidMoves for use in other functions before the full implementation
  const basicGetValidMoves = (piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] => {
    // Basic implementation that just looks at standard moves without special moves
    const moves: Position[] = [];
    const isInBounds = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;

    // Just enough implementation to break circular dependency
    switch (piece.type) {
      case 'pawn': {
        const direction = piece.color === 'white' ? -1 : 1;
        // Forward moves
        if (isInBounds(pos.row + direction, pos.col) &&
          !checkBoard[pos.row + direction][pos.col]) {
          moves.push({ row: pos.row + direction, col: pos.col });
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
      case 'king': {
        const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
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
      // Other piece types would go here
    }

    return moves;
  };

  // Memoized check detection function to prevent stale state
  const wouldBeInCheck = useCallback((
    from: Position,
    to: Position,
    color: PieceColor,
    checkBoard: (ChessPiece | null)[][] = board
  ): boolean => {
    // Handle special moves differently
    const movingPiece = checkBoard[from.row][from.col];
    if (!movingPiece) return false; // No piece to move

    const testBoard = deepCloneBoard(checkBoard);

    // Handle castling
    if (movingPiece.type === 'king' && Math.abs(to.col - from.col) === 2) {
      // If attempting to castle while in check, it's invalid
      if (isInCheck(color, checkBoard)) return true;

      // Handle castling specifically
      const row = from.row;
      const isKingside = to.col > from.col;

      // Move king
      testBoard[to.row][to.col] = movingPiece;
      testBoard[from.row][from.col] = null;

      // Move rook
      const rookCol = isKingside ? 7 : 0;
      const newRookCol = isKingside ? 5 : 3;
      testBoard[row][newRookCol] = testBoard[row][rookCol];
      testBoard[row][rookCol] = null;
    }
    // Handle en passant
    else if (
      movingPiece.type === 'pawn' &&
      enPassantTarget &&
      to.col === enPassantTarget.col &&
      to.row === (movingPiece.color === 'white' ? enPassantTarget.row - 1 : enPassantTarget.row + 1)
    ) {
      // Move pawn
      testBoard[to.row][to.col] = movingPiece;
      testBoard[from.row][from.col] = null;

      // Remove captured pawn
      testBoard[enPassantTarget.row][enPassantTarget.col] = null;
    }
    // Normal move
    else {
      testBoard[to.row][to.col] = movingPiece;
      testBoard[from.row][from.col] = null;
    }

    // Find king position in the new board state
    let kingPos: Position | null = null;
    if (movingPiece.type === 'king') {
      kingPos = to;
    } else {
      // Find the king
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = testBoard[row][col];
          if (piece?.type === 'king' && piece.color === color) {
            kingPos = { row, col };
            break;
          }
        }
        if (kingPos) break;
      }
    }

    if (!kingPos) return false;

    // Check if king is under attack in the new position
    return checkSquareUnderAttack(kingPos, color, testBoard);
  }, [board, enPassantTarget, isInCheck]);

  // Improved checkmate detection that includes all special moves
  const isInCheckmate = useCallback((color: PieceColor, checkBoard: (ChessPiece | null)[][] = board): boolean => {
    // If not in check, cannot be checkmate
    if (!isInCheck(color, checkBoard)) return false;

    // Check if any move can get out of check
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = checkBoard[row][col];
        if (piece && piece.color === color) {
          // Use basicGetValidMoves to avoid circular dependency
          const moves = basicGetValidMoves(piece, { row, col }, checkBoard);

          for (const move of moves) {
            // See if this move would take us out of check
            if (!wouldBeInCheck({ row, col }, move, color, checkBoard)) {
              return false; // Found a legal move
            }
          }
        }
      }
    }

    return true; // No legal moves found
  }, [basicGetValidMoves, isInCheck, wouldBeInCheck, board]);

  // Memoized basic move generation to prevent stale state
  const getBasicMoves = useCallback((piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] => {
    const moves: Position[] = [];
    const isInBounds = (row: number, col: number) =>
      row >= 0 && row < 8 && col >= 0 && col < 8;

    switch (piece.type) {
      case 'pawn': {
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        // Check one space forward
        if (isInBounds(pos.row + direction, pos.col) &&
          !checkBoard[pos.row + direction][pos.col]) {
          moves.push({ row: pos.row + direction, col: pos.col });

          // Check two spaces forward from starting position
          if (pos.row === startRow &&
            isInBounds(pos.row + 2 * direction, pos.col) &&
            !checkBoard[pos.row + 2 * direction][pos.col]) {
            moves.push({ row: pos.row + 2 * direction, col: pos.col });
          }
        }

        // Check diagonal captures
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
  }, [board]);

  // Wrapper around checkSquareUnderAttack with simplified parameters
  const isSquareUnderAttack = useCallback((
    pos: Position,
    defenderColor: PieceColor,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    ignoreCastling: boolean = false, // Parameter kept for API compatibility but unused
    checkBoard: (ChessPiece | null)[][] = board
  ): boolean => {
    // Use the direct implementation for most cases
    return checkSquareUnderAttack(pos, defenderColor, checkBoard);
  }, [board]);

  // Memoized en passant move generation
  const getEnPassantMoves = useCallback((piece: ChessPiece, pos: Position): Position[] => {
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
  }, [enPassantTarget]);

  // Memoized castling move generation with improved detection
  const getCastlingMoves = useCallback((piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] => {
    const moves: Position[] = [];

    // Check if castling is possible
    if (
      piece.type === 'king' &&
      !hasMoved[`${piece.color}-king`] &&
      !isInCheck(piece.color, checkBoard)  // King can't castle out of check
    ) {
      const row = piece.color === 'white' ? 7 : 0;

      // Verify rook is present at the right position
      const kingsideRook = checkBoard[row][7];
      const queensideRook = checkBoard[row][0];

      // Kingside castling
      if (
        !hasMoved[`${piece.color}-rook-right`] &&
        kingsideRook &&
        kingsideRook.type === 'rook' &&
        kingsideRook.color === piece.color
      ) {
        // Check for empty squares and squares not under attack
        if (
          !checkBoard[row][5] && !checkBoard[row][6] && // Squares must be empty
          !isSquareUnderAttack({ row, col: 5 }, piece.color, true, checkBoard) &&
          !isSquareUnderAttack({ row, col: 6 }, piece.color, true, checkBoard)
        ) {
          moves.push({ row, col: 6 });
        }
      }

      // Queenside castling
      if (
        !hasMoved[`${piece.color}-rook-left`] &&
        queensideRook &&
        queensideRook.type === 'rook' &&
        queensideRook.color === piece.color
      ) {
        // Check for empty squares and squares not under attack
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
  }, [board, hasMoved, isInCheck, isSquareUnderAttack]);

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

  // Removed unused function initializeBoard() - we're using the board from the reducer state

  // Core move validation - memoized to prevent stale state
  const getValidMoves = useCallback((piece: ChessPiece, pos: Position, checkBoard: (ChessPiece | null)[][] = board): Position[] => {
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
  }, [getBasicMoves, getEnPassantMoves, getCastlingMoves, board]);

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

  // Improved promotion handler with proper game state checking
  const handlePromotion = useCallback((pieceType: PieceType) => {
    if (!promotionPawn) return;

    try {
      // First, abort any pending AI operations since state is changing
      if (aiMoveAbortController.current) {
        aiMoveAbortController.current.abort();
        aiMoveAbortController.current = null;
      }
      if (aiHintAbortController.current) {
        aiHintAbortController.current.abort();
        aiHintAbortController.current = null;
      }

      // Promote the pawn - this will also change processingAction flag in the state
      actions.promotePawn(pieceType);

      // Create a simulated board to check the game state after promotion
      const newBoard = deepCloneBoard(board);

      // Add the new promoted piece to simulated board
      newBoard[promotionPawn.position.row][promotionPawn.position.col] = {
        type: pieceType,
        color: promotionPawn.color
      };

      // Check game state after promotion
      const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';

      // Handle check state
      if (isInCheck(nextPlayer, newBoard)) {
        playSound(SoundTypes.CHECK);

        if (isInCheckmate(nextPlayer, newBoard)) {
          actions.setGameState({
            isOver: true,
            winner: currentPlayer,
            message: `Checkmate! ${currentPlayer} wins!`
          });
        } else {
          actions.setGameState({
            ...gameState,
            message: `${nextPlayer} is in check!`
          });
        }
      }
      // Handle draw state
      else if (isDraw(newBoard, nextPlayer)) {
        let drawMessage = "Draw!";

        if (isStalemate(nextPlayer, newBoard)) {
          drawMessage = "Stalemate! Game is a draw!";
        } else if (isThreefoldRepetition()) {
          drawMessage = "Draw by threefold repetition!";
        } else if (isFiftyMoveRule()) {
          drawMessage = "Draw by 50-move rule!";
        }

        actions.setGameState({
          isOver: true,
          winner: null,
          message: drawMessage
        });
      }
      // Clear any previous messages if no check or draw
      else {
        actions.setGameState({
          ...gameState,
          message: ''
        });
      }
    } catch (error) {
      console.error('Error during promotion:', error);
      // Ensure we don't leave the game in a locked state if something goes wrong
      actions.setProcessing(false);
    }
  }, [
    promotionPawn,
    board,
    currentPlayer,
    gameState,
    isInCheck,
    isInCheckmate,
    isDraw,
    isStalemate,
    isThreefoldRepetition,
    isFiftyMoveRule,
    actions
  ]);

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

    const isCapture = board[to.row][to.col] !== null;
    const isPawnMove = piece.type === 'pawn';

    // Generate move notation
    const moveNotation = generateMoveNotation(piece, from, to, isCapture);

    // Handle the move with appropriate action based on move type
    if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
      // Castling
      const isKingside = to.col > from.col;
      const rookRow = from.row;
      const rookFromCol = isKingside ? 7 : 0;
      const rookToCol = isKingside ? 5 : 3;

      actions.handleCastling(
        from,
        to,
        { row: rookRow, col: rookFromCol },
        { row: rookRow, col: rookToCol },
        piece.color,
        moveNotation
      );
    } else if (piece.type === 'pawn') {
      // En passant capture
      if (
        enPassantTarget &&
        to.col === enPassantTarget.col &&
        to.row === (piece.color === 'white' ? enPassantTarget.row - 1 : enPassantTarget.row + 1)
      ) {
        actions.handleEnPassant(
          from,
          to,
          enPassantTarget,
          moveNotation
        );
      }
      // Promotion
      else if (to.row === 0 || to.row === 7) {
        actions.setPromotionPawn(
          { row: to.row, col: to.col },
          piece.color
        );
        return;
      }
      // Regular pawn move
      else {
        actions.movePiece(from, to, moveNotation, isPawnMove, isCapture);
      }
    }
    // Regular piece move
    else {
      actions.movePiece(from, to, moveNotation, isPawnMove, isCapture);
    }

    // After the move is dispatched, update game state based on new board position
    // Create a temporary board for state checks
    const newBoard = deepCloneBoard(board);
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;

    // Special handling for en passant captures
    if (piece.type === 'pawn' && enPassantTarget &&
      to.col === enPassantTarget.col &&
      to.row === (piece.color === 'white' ? enPassantTarget.row - 1 : enPassantTarget.row + 1)) {
      newBoard[enPassantTarget.row][enPassantTarget.col] = null;
    }

    // Check for check/checkmate/stalemate
    const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
    if (isInCheck(nextPlayer, newBoard)) {
      playSound(SoundTypes.CHECK);

      if (isInCheckmate(nextPlayer, newBoard)) {
        actions.setGameState({
          isOver: true,
          winner: currentPlayer,
          message: `Checkmate! ${currentPlayer} wins!`
        });
      } else {
        actions.setGameState({
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

      actions.setGameState({
        isOver: true,
        winner: null,
        message: drawMessage
      });
    } else {
      actions.setGameState({ ...gameState, message: '' });
    }
  }, [
    board,
    currentPlayer,
    enPassantTarget,
    gameState,
    getValidMoves,
    wouldBeInCheck,
    isInCheck,
    isInCheckmate,
    isDraw,
    isStalemate,
    isThreefoldRepetition,
    isFiftyMoveRule,
    actions
  ]);

  // Effect to handle AI moves
  useEffect(() => {
    // Don't start AI move if:
    // - AI is disabled
    // - It's not black's turn
    // - Game is over
    // - There's a promotion pending (extremely important - must wait for user choice)
    // - There's another operation in progress
    // - AI is already thinking
    if (isAIEnabled && currentPlayer === 'black' && !gameState.isOver && !promotionPawn && !processingAction && !isAIThinking) {
      // Create new abort controller for this AI move operation
      aiMoveAbortController.current = new AbortController();
      const signal = aiMoveAbortController.current.signal;

      // Set processing flags
      actions.setProcessing(true);
      actions.setAIThinking(true);

      console.log('AI should make a move now');

      let aiMoveTimeout: NodeJS.Timeout | null = null;

      const makeAIMove = async () => {
        try {
          // Wait a short delay to show the AI is "thinking"
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 500);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('AI move aborted during thinking delay'));
            });
          });

          // Check if operation was aborted
          if (signal.aborted) {
            console.log('AI move aborted after thinking delay');
            return;
          }

          console.log('Requesting AI move...');

          // Create a race between the AI move and a timeout
          const movePromise = getAIMove(board, currentPlayer, hasMoved, enPassantTarget);

          // Add a generous timeout to prevent hanging
          const timeoutPromise = new Promise<null>((resolve, reject) => {
            aiMoveTimeout = setTimeout(() => {
              console.log('AI move timed out after 20 seconds');
              resolve(null);
            }, 20000);

            signal.addEventListener('abort', () => {
              if (aiMoveTimeout) clearTimeout(aiMoveTimeout);
              reject(new Error('AI move aborted during calculation'));
            });
          });

          // Race the two promises
          const move = await Promise.race([movePromise, timeoutPromise]);

          // Clear the timeout if move completed before timeout
          if (aiMoveTimeout) {
            clearTimeout(aiMoveTimeout);
            aiMoveTimeout = null;
          }

          // Check if operation was aborted
          if (signal.aborted) {
            console.log('AI move aborted after calculation');
            return;
          }

          console.log('AI returned move:', move);
          if (move) {
            console.log('Executing AI move from', move.from, 'to', move.to);
            handleMove(move.from, move.to);
          } else {
            console.log('AI did not return a move');
          }
        } catch (error) {
          // Only log real errors, not abort errors
          if (!signal.aborted) {
            console.error('AI move error:', error);
          } else {
            console.log('AI move was aborted:', error);
          }
        } finally {
          // Clean up and reset state if this is still the current operation
          if (aiMoveAbortController.current?.signal === signal) {
            actions.setAIThinking(false);
            actions.setProcessing(false);
            aiMoveAbortController.current = null;
          }
        }
      };

      // Use setTimeout to ensure makeAIMove doesn't execute in the same tick
      // This helps prevent React state update loops
      const aiMoveTimer = setTimeout(() => {
        makeAIMove();
      }, 0);

      // Add event listener to abort the operation if signal is aborted
      signal.addEventListener('abort', () => {
        clearTimeout(aiMoveTimer);
      });
    }

    return () => {
      // When dependencies change, abort any in-progress AI move operation
      if (aiMoveAbortController.current) {
        console.log('Aborting in-progress AI move due to dependency change');
        aiMoveAbortController.current.abort();
        aiMoveAbortController.current = null;
      }
    };
  }, [currentPlayer, isAIEnabled, gameState.isOver, promotionPawn, processingAction, isAIThinking,
    board, enPassantTarget, getAIMove, handleMove, hasMoved, actions]);

  // Handle getting a hint from AI with timeout protection and proper cancellation
  const handleGetHint = async () => {
    // Don't allow hint request if game is over, AI is still initializing, 
    // or there's already an operation in progress
    if (gameState.isOver || aiLoading || isAIThinking || processingAction) return;

    // First, abort any existing hint request
    if (aiHintAbortController.current) {
      aiHintAbortController.current.abort();
    }

    // Create a new abort controller for this hint operation
    aiHintAbortController.current = new AbortController();
    const signal = aiHintAbortController.current.signal;

    // Set state to indicate processing
    actions.setProcessing(true);
    actions.setAIThinking(true);

    console.log('Getting hint for current player:', currentPlayer);

    let hintTimeout: NodeJS.Timeout | null = null;

    try {
      // Create a promise that will resolve with null after a timeout
      const timeoutPromise = new Promise<null>((resolve, reject) => {
        hintTimeout = setTimeout(() => {
          console.log('Hint request timed out after 10 seconds');
          resolve(null);
        }, 10000);

        signal.addEventListener('abort', () => {
          if (hintTimeout) clearTimeout(hintTimeout);
          reject(new Error('Hint request aborted'));
        });
      });

      // Race between the hint request and the timeout
      const hintPosition = await Promise.race([
        getHint(board, currentPlayer),
        timeoutPromise
      ]);

      // Clear the timeout
      if (hintTimeout) {
        clearTimeout(hintTimeout);
        hintTimeout = null;
      }

      // Check if operation was aborted
      if (signal.aborted) {
        console.log('Hint request aborted after calculation');
        return;
      }

      if (hintPosition) {
        console.log('Hint received:', hintPosition);
        // Temporarily update valid moves to show hint
        // This will add the hint position to the valid moves
        const tempValidMoves = [...validMoves, hintPosition];
        actions.selectPiece(selectedPiece || { row: 0, col: 0 },
          { type: 'pawn', color: currentPlayer },
          tempValidMoves);

        // Create abortable timeout for hint display
        const hintDisplayPromise = new Promise<void>((resolve, reject) => {
          const displayTimer = setTimeout(() => {
            resolve();
          }, 2000);

          signal.addEventListener('abort', () => {
            clearTimeout(displayTimer);
            reject(new Error('Hint display aborted'));
          });
        });

        // Wait for hint display time or abort
        try {
          await hintDisplayPromise;

          // If not aborted, restore normal selection state
          if (!signal.aborted) {
            if (selectedPiece) {
              // If a piece is still selected, keep its real valid moves
              const piece = board[selectedPiece.row][selectedPiece.col];
              if (piece) {
                const realValidMoves = getValidMoves(piece, selectedPiece).filter(
                  move => !wouldBeInCheck(selectedPiece, move, currentPlayer)
                );
                actions.selectPiece(selectedPiece, piece, realValidMoves);
              } else {
                actions.deselectPiece();
              }
            } else {
              actions.deselectPiece();
            }
          }
        } catch {
          // Hint display was aborted, we don't need the error parameter
          console.log('Hint display was aborted');
        }
      } else {
        console.log('No hint received from AI');
      }
    } catch (error) {
      // Only log real errors, not abort errors
      if (!signal.aborted) {
        console.error('Hint error:', error);
      } else {
        console.log('Hint request was aborted:', error);
      }
    } finally {
      // Clean up and reset state if this is still the current operation
      if (aiHintAbortController.current?.signal === signal) {
        actions.setAIThinking(false);
        actions.setProcessing(false);
        aiHintAbortController.current = null;
      }
    }
  };

  // Make this change to your handleSquareClick function
  function handleSquareClick(row: number, col: number) {
    // Debug logging
    console.log(`Square clicked: row=${row}, col=${col}`);

    // If the game appears stuck, try to reset it when user clicks
    if (processingAction && !promotionPawn && !isAIThinking) {
      console.warn("Game appears stuck - resetting state before processing click");
      resetGameState();
    }

    // Prevent clicks during specific game states
    if (gameState.isOver || isAIThinking || processingAction || (currentPlayer === 'black' && isAIEnabled)) {
      console.log("Click blocked due to game state:", {
        gameOver: gameState.isOver,
        aiThinking: isAIThinking,
        processing: processingAction,
        blackTurnWithAI: (currentPlayer === 'black' && isAIEnabled)
      });
      return;
    }

    console.log("Click should be processed");

    const piece = board[row][col];
    console.log("Piece at clicked position:", piece);

    // Set processing flag during the move operation to prevent other actions
    actions.setProcessing(true);

    try {
      if (selectedPiece) {
        console.log("Selected piece exists:", selectedPiece);

        // If clicking on a destination square
        if (selectedPiece.row !== row || selectedPiece.col !== col) {
          console.log("Attempting move from", selectedPiece, "to", { row, col });
          handleMove(selectedPiece, { row, col });
        }
        // If clicking on the selected piece again, deselect it
        else {
          console.log("Deselecting piece");
          actions.deselectPiece();
        }
      }
      // Selecting a new piece
      else if (piece?.color === currentPlayer) {
        console.log("Selecting new piece:", piece);
        const position = { row, col };

        // Calculate legal moves with extra logging
        console.log("Getting valid moves for piece");
        const allMoves = getValidMoves(piece, position);
        console.log("All possible moves:", allMoves);

        const legalMoves = allMoves.filter(move => {
          const isLegal = !wouldBeInCheck(position, move, currentPlayer);
          console.log(`Move to ${move.row},${move.col} legal? ${isLegal}`);
          return isLegal;
        });
        
        actions.selectPiece(position, piece, legalMoves);
      }
      
      // Always set processingAction to false when square click handling is complete
      actions.setProcessing(false);
    } catch (error) {
      console.error("Error handling square click:", error);
      actions.setProcessing(false);
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
                      onClick={actions.newGame}
                    >
                      New Game
                    </button>

                    <button
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg 
          transition-colors duration-200 shadow-lg hover:shadow-xl"
                      onClick={actions.toggleInfo}
                      aria-label="Game Information"
                    >
                      ℹ️
                    </button>

                    {/* Development Diagnostic Button (Hidden in Production) */}
                    {process.env.NODE_ENV === 'development' && (
                      <button
                        className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg 
          transition-colors duration-200 shadow-lg hover:shadow-xl"
                        onClick={() => setShowDiagnostics(!showDiagnostics)}
                        aria-label="Engine Diagnostics"
                      >
                        🧪
                      </button>
                    )}

                    {/* Reset Game State Button */}
                    <button
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg shadow-lg"
                      onClick={() => {
                        // Just execute the reset actions without any complex code
                        actions.setProcessing(false);
                        actions.setAIThinking(false);
                        actions.deselectPiece();

                        // Force promotion if needed
                        if (state.promotionPawn) {
                          actions.promotePawn('queen');
                        }

                        alert("Game state reset attempted");
                      }}
                    >
                      🔄 Reset
                    </button>

                    <button
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg 
                          transition-colors duration-200 shadow-lg hover:shadow-xl"
                      onClick={actions.toggleMoveHistory}
                      aria-label="Move History"
                    >
                      📜
                    </button>
                  </div>

                  <AIControls
                    onGetHint={handleGetHint}
                    isAIEnabled={isAIEnabled}
                    setAIEnabled={(enabled) => actions.toggleAI(enabled)}
                    isAIThinking={isAIThinking}
                  />
                </div>
              </div>

              {showMoveHistory && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
                  onClick={actions.toggleMoveHistory}>
                  <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-xs w-full border-2 border-amber-600 m-4"
                    onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold text-amber-400">Move History</h2>
                      <button
                        className="text-amber-400 hover:text-amber-300 text-xl font-bold"
                        onClick={actions.toggleMoveHistory}
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
                              <span className="font-medium text-amber-500 mr-1">{Math.floor(index / 2) + 1}.</span>
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={actions.toggleInfo}>
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
                      onClick={actions.toggleInfo}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              {process.env.NODE_ENV !== 'production' && (
                <button
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg shadow-lg"
                  onClick={() => {
                    console.log("Manually resetting processing flag");
                    actions.setProcessing(false);
                    actions.setAIThinking(false);
                    if (promotionPawn) {
                      console.log("Forcing promotion to queen to unblock game");
                      actions.promotePawn('queen');
                    }
                    console.log("Current state:", {
                      processingAction,
                      isAIThinking,
                      promotionPawn,
                      selectedPiece,
                      validMoves
                    });
                    alert("Game state reset attempted");
                  }}
                >
                  🔄 Reset
                </button>
              )}
              {/* Promotion dialog with backdrop overlay */}
              {promotionPawn && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                  <PromotionDialog
                    pawn={promotionPawn}
                    onSelect={handlePromotion}
                  />
                </div>
              )}

              {isAIThinking && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                  <div className="bg-amber-800 p-4 rounded-lg shadow-xl text-white animate-pulse">
                    AI is thinking...
                  </div>
                </div>
              )}

              {/* Diagnostics Panel (Only in Development) */}
              {showDiagnostics && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowDiagnostics(false)}>
                  <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full border-2 border-red-600 m-4 overflow-auto max-h-[80vh]"
                    onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center justify-between">
                      <span>Engine Diagnostics</span>
                      <button onClick={() => setShowDiagnostics(false)} className="text-red-400 hover:text-red-300">✕</button>
                    </h2>

                    <div className="space-y-4 text-sm text-white">
                      <div>
                        <h3 className="text-lg font-bold mb-2 text-red-300">AI Status</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-700 p-2 rounded">Initialized: <span className={aiInitialized ? "text-green-400" : "text-red-400"}>{aiInitialized ? "Yes" : "No"}</span></div>
                          <div className="bg-gray-700 p-2 rounded">Loading: <span className={aiLoading ? "text-yellow-400" : "text-green-400"}>{aiLoading ? "Yes" : "No"}</span></div>
                          <div className="bg-gray-700 p-2 rounded">Error: <span className={aiError ? "text-red-400" : "text-green-400"}>{aiError || "None"}</span></div>
                          <div className="bg-gray-700 p-2 rounded">AI Enabled: <span className={isAIEnabled ? "text-green-400" : "text-gray-400"}>{isAIEnabled ? "Yes" : "No"}</span></div>
                          <div className="bg-gray-700 p-2 rounded">AI Thinking: <span className={isAIThinking ? "text-yellow-400" : "text-green-400"}>{isAIThinking ? "Yes" : "No"}</span></div>
                          <div className="bg-gray-700 p-2 rounded">Processing Action: <span className={processingAction ? "text-yellow-400" : "text-green-400"}>{processingAction ? "Yes" : "No"}</span></div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg 
              transition-colors duration-200 shadow-lg hover:shadow-xl mr-2"
                          onClick={testAI}
                          aria-label="Test AI Engine"
                        >
                          Test AI Engine
                        </button>

                        <button
                          className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg 
              transition-colors duration-200 shadow-lg hover:shadow-xl"
                          onClick={checkStockfishFiles}
                          aria-label="Check Stockfish Files"
                        >
                          Check Stockfish Files
                        </button>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-2 text-red-300">Worker Diagnostics</h3>
                        <div className="flex space-x-2">
                          <button
                            className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded"
                            onClick={async () => {
                              const { checkStockfishFiles } = await import('@/utils/workerUtils');
                              await checkStockfishFiles();
                              alert('File check complete - see console for results');
                            }}
                          >
                            Check Files
                          </button>
                          <button
                            className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded"
                            onClick={async () => {
                              try {
                                const worker = new Worker('/stockfish/stockfish.worker.js');
                                worker.onmessage = (e) => {
                                  console.log('Worker test message:', e.data);
                                  worker.terminate();
                                  alert('Worker test succeeded - message received');
                                };
                                worker.onerror = (e) => {
                                  console.error('Worker test error:', e);
                                  alert(`Worker test failed: ${e.message}`);
                                };
                                worker.postMessage({ cmd: 'command', param: 'uci' });
                              } catch (error) {
                                console.error('Worker creation error:', error);
                                alert(`Failed to create worker: ${error instanceof Error ? error.message : String(error)}`);
                              }
                            }}
                          >
                            Test Worker
                          </button>
                          <button
                            className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded"
                            onClick={() => {
                              window.location.reload();
                            }}
                          >
                            Reload Page
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold mb-2 text-red-300">Browser Info</h3>
                        <div className="bg-gray-700 p-2 rounded space-y-1">
                          <div>User Agent: <span className="text-blue-300">{navigator.userAgent}</span></div>
                          <div>WebAssembly Supported: <span className={typeof WebAssembly === 'object' ? "text-green-400" : "text-red-400"}>{typeof WebAssembly === 'object' ? "Yes" : "No"}</span></div>
                          <div>Web Workers Supported: <span className={'Worker' in window ? "text-green-400" : "text-red-400"}>{'Worker' in window ? "Yes" : "No"}</span></div>
                          <div>Environment: <span className="text-blue-300">{process.env.NODE_ENV}</span></div>
                        </div>
                      </div>

                      <div className="border-t border-gray-600 pt-4">
                        <p className="text-gray-400 italic">
                          This panel is only available in development mode and is designed to help troubleshoot engine issues.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      export default ChessGame;