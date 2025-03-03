import { useReducer, useCallback } from 'react';
import type { 
  ChessPiece, 
  PieceColor, 
  Position, 
  PieceType,
  GameState
} from '@/types/chess';
import { playSound, SoundTypes } from '@/utils/soundUtils';

// Helper function to deep clone the board (used in multiple actions)
function deepCloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map(row => 
    row.map(piece => 
      piece ? { ...piece } : null
    )
  );
}

// Define the state shape
export interface ChessState {
  board: (ChessPiece | null)[][];
  currentPlayer: PieceColor;
  selectedPiece: Position | null;
  validMoves: Position[];
  hasMoved: {[key: string]: boolean};
  enPassantTarget: Position | null;
  moveHistory: string[];
  promotionPawn: {
    position: Position;
    color: PieceColor;
  } | null;
  gameState: GameState;
  halfMoveCount: number;
  boardPositions: string[];
  isAIEnabled: boolean;
  isAIThinking: boolean;
  showInfo: boolean;
  showMoveHistory: boolean;
  processingAction: boolean; // Flag to track async operations in progress
}

// Define action types
export type ChessAction =
  | { type: 'SELECT_PIECE'; position: Position; piece: ChessPiece; validMoves: Position[] }
  | { type: 'DESELECT_PIECE' }
  | { type: 'MOVE_PIECE'; from: Position; to: Position; notation: string; isPawnMove: boolean; isCapture: boolean }
  | { type: 'HANDLE_CASTLING'; kingFrom: Position; kingTo: Position; rookFrom: Position; rookTo: Position; kingColor: PieceColor; notation: string }
  | { type: 'HANDLE_EN_PASSANT'; from: Position; to: Position; capturedPawnPosition: Position; notation: string }
  | { type: 'SET_PROMOTION_PAWN'; position: Position; color: PieceColor }
  | { type: 'PROMOTE_PAWN'; pieceType: PieceType }
  | { type: 'SET_GAME_STATE'; gameState: GameState }
  | { type: 'NEW_GAME' }
  | { type: 'TOGGLE_INFO' }
  | { type: 'TOGGLE_MOVE_HISTORY' }
  | { type: 'TOGGLE_AI'; enabled: boolean }
  | { type: 'SET_AI_THINKING'; isThinking: boolean }
  | { type: 'SET_PROCESSING'; isProcessing: boolean };

// Setup initial board
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

// Initial state
export const initialChessState: ChessState = {
  board: initializeBoard(),
  currentPlayer: 'white',
  selectedPiece: null,
  validMoves: [],
  hasMoved: {},
  enPassantTarget: null,
  moveHistory: [],
  promotionPawn: null,
  gameState: {
    isOver: false,
    winner: null,
    message: ''
  },
  halfMoveCount: 0,
  boardPositions: [],
  isAIEnabled: false,
  isAIThinking: false,
  showInfo: false,
  showMoveHistory: false,
  processingAction: false
};

// Generate a unique representation of the current board position
function generateBoardPosition(positionBoard: (ChessPiece | null)[][], positionPlayer: PieceColor, hasMoved: {[key: string]: boolean}): string {
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

// The reducer function
export function chessReducer(state: ChessState, action: ChessAction): ChessState {
  switch (action.type) {
    case 'SELECT_PIECE': {
      // If it's not the player's turn or game is over, or an operation is in progress, don't select
      if (state.gameState.isOver || 
          (state.isAIEnabled && state.currentPlayer === 'black') || 
          state.isAIThinking || 
          state.processingAction) {
        return state;
      }
      
      return {
        ...state,
        selectedPiece: action.position,
        validMoves: action.validMoves
      };
    }
    
    case 'DESELECT_PIECE': {
      return {
        ...state,
        selectedPiece: null,
        validMoves: []
      };
    }
    
    case 'MOVE_PIECE': {
      const { from, to, notation, isPawnMove, isCapture } = action;
      const newBoard = deepCloneBoard(state.board);
      const piece = newBoard[from.row][from.col];
      
      if (!piece) return state;
      
      // Handle standard piece movement
      newBoard[to.row][to.col] = piece;
      newBoard[from.row][from.col] = null;
      
      // Track piece movements for castling if it's a king or rook
      let newHasMoved = { ...state.hasMoved };
      if (piece.type === 'king' || piece.type === 'rook') {
        const pieceKey = piece.type === 'king' ? 'king' : 
          `rook-${from.col === 0 ? 'left' : 'right'}`;
        newHasMoved = {
          ...newHasMoved,
          [`${piece.color}-${pieceKey}`]: true
        };
      }
      
      // Calculate new half-move count for 50-move rule
      // Reset on pawn moves or captures
      const newHalfMoveCount = isPawnMove || isCapture ? 0 : state.halfMoveCount + 1;
      
      // Update en passant target for pawns moving two squares
      let newEnPassantTarget = null;
      if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
        newEnPassantTarget = {
          row: (to.row + from.row) / 2,
          col: to.col
        };
      }
      
      // Play sound
      if (isCapture) {
        playSound(SoundTypes.CAPTURE);
      } else {
        playSound(SoundTypes.MOVE);
      }
      
      // Add move to history
      const newMoveHistory = [...state.moveHistory, notation];
      
      // Add position to boardPositions for three-fold repetition detection
      const nextPlayer = state.currentPlayer === 'white' ? 'black' : 'white';
      const newBoardPosition = generateBoardPosition(newBoard, nextPlayer, newHasMoved);
      const newBoardPositions = [...state.boardPositions, newBoardPosition];
      
      return {
        ...state,
        board: newBoard,
        currentPlayer: nextPlayer,
        selectedPiece: null,
        validMoves: [],
        hasMoved: newHasMoved,
        enPassantTarget: newEnPassantTarget,
        moveHistory: newMoveHistory,
        boardPositions: newBoardPositions,
        halfMoveCount: newHalfMoveCount
      };
    }
    
    case 'HANDLE_CASTLING': {
      const { kingFrom, kingTo, rookFrom, rookTo, kingColor, notation } = action;
      const newBoard = deepCloneBoard(state.board);
      const king = newBoard[kingFrom.row][kingFrom.col];
      const rook = newBoard[rookFrom.row][rookFrom.col];
      
      if (!king || !rook) return state;
      
      // Move king
      newBoard[kingTo.row][kingTo.col] = king;
      newBoard[kingFrom.row][kingFrom.col] = null;
      
      // Move rook
      newBoard[rookTo.row][rookTo.col] = rook;
      newBoard[rookFrom.row][rookFrom.col] = null;
      
      // Update hasMoved state for king and rook
      const isKingside = kingTo.col > kingFrom.col;
      const newHasMoved = {
        ...state.hasMoved,
        [`${kingColor}-king`]: true,
        [`${kingColor}-rook-${isKingside ? 'right' : 'left'}`]: true
      };
      
      // Play sound
      playSound(SoundTypes.MOVE);
      
      // Add move to history
      const newMoveHistory = [...state.moveHistory, notation];
      
      // Add position to boardPositions
      const nextPlayer = state.currentPlayer === 'white' ? 'black' : 'white';
      const newBoardPosition = generateBoardPosition(newBoard, nextPlayer, newHasMoved);
      const newBoardPositions = [...state.boardPositions, newBoardPosition];
      
      // Update halfMoveCount (castling is not a capture or pawn move)
      const newHalfMoveCount = state.halfMoveCount + 1;
      
      return {
        ...state,
        board: newBoard,
        currentPlayer: nextPlayer,
        selectedPiece: null,
        validMoves: [],
        hasMoved: newHasMoved,
        moveHistory: newMoveHistory,
        boardPositions: newBoardPositions,
        halfMoveCount: newHalfMoveCount,
        enPassantTarget: null
      };
    }
    
    case 'HANDLE_EN_PASSANT': {
      const { from, to, capturedPawnPosition, notation } = action;
      const newBoard = deepCloneBoard(state.board);
      const pawn = newBoard[from.row][from.col];
      
      if (!pawn) return state;
      
      // Move pawn
      newBoard[to.row][to.col] = pawn;
      newBoard[from.row][from.col] = null;
      
      // Remove captured pawn
      newBoard[capturedPawnPosition.row][capturedPawnPosition.col] = null;
      
      // Play capture sound
      playSound(SoundTypes.CAPTURE);
      
      // Add move to history
      const newMoveHistory = [...state.moveHistory, notation];
      
      // Add position to boardPositions
      const nextPlayer = state.currentPlayer === 'white' ? 'black' : 'white';
      const newBoardPosition = generateBoardPosition(newBoard, nextPlayer, state.hasMoved);
      const newBoardPositions = [...state.boardPositions, newBoardPosition];
      
      // Reset halfMoveCount (en passant is a pawn capture)
      const newHalfMoveCount = 0;
      
      return {
        ...state,
        board: newBoard,
        currentPlayer: nextPlayer,
        selectedPiece: null,
        validMoves: [],
        enPassantTarget: null,
        moveHistory: newMoveHistory,
        boardPositions: newBoardPositions,
        halfMoveCount: newHalfMoveCount
      };
    }
    
    case 'SET_PROMOTION_PAWN': {
      const { position, color } = action;
      const newBoard = deepCloneBoard(state.board);
      
      // Remove the pawn from original position (it's waiting for promotion)
      if (state.selectedPiece) {
        newBoard[state.selectedPiece.row][state.selectedPiece.col] = null;
      }
      
      // Important: Set processingAction to true when promotion is pending
      // This will block all other actions until promotion is complete
      return {
        ...state,
        board: newBoard,
        promotionPawn: { position, color },
        selectedPiece: null,
        validMoves: [],
        processingAction: true  // Lock the game state during promotion
      };
    }
    
    case 'PROMOTE_PAWN': {
      if (!state.promotionPawn) return state;
      
      const newBoard = deepCloneBoard(state.board);
      const { position, color } = state.promotionPawn;
      
      // Add the new promoted piece
      newBoard[position.row][position.col] = {
        type: action.pieceType,
        color
      };
      
      // Play sound
      playSound(SoundTypes.MOVE);
      
      // Reset half-move counter (pawn move)
      const newHalfMoveCount = 0;
      
      // Add position to boardPositions
      const nextPlayer = state.currentPlayer === 'white' ? 'black' : 'white';
      const newBoardPosition = generateBoardPosition(newBoard, nextPlayer, state.hasMoved);
      const newBoardPositions = [...state.boardPositions, newBoardPosition];
      
      return {
        ...state,
        board: newBoard,
        currentPlayer: nextPlayer,
        promotionPawn: null,
        halfMoveCount: newHalfMoveCount,
        boardPositions: newBoardPositions,
        processingAction: false  // Unlock the game state after promotion is complete
      };
    }
    
    case 'SET_GAME_STATE': {
      return {
        ...state,
        gameState: action.gameState
      };
    }
    
    case 'NEW_GAME': {
      // Ensure we reset all processing flags when starting a new game
      return {
        ...initialChessState,
        isAIEnabled: state.isAIEnabled, // Preserve AI settings
        processingAction: false,        // Ensure game isn't locked
        isAIThinking: false             // Ensure AI isn't marked as thinking
      };
    }
    
    case 'TOGGLE_INFO': {
      return {
        ...state,
        showInfo: !state.showInfo
      };
    }
    
    case 'TOGGLE_MOVE_HISTORY': {
      return {
        ...state,
        showMoveHistory: !state.showMoveHistory
      };
    }
    
    case 'TOGGLE_AI': {
      return {
        ...state,
        isAIEnabled: action.enabled
      };
    }
    
    case 'SET_AI_THINKING': {
      return {
        ...state,
        isAIThinking: action.isThinking
      };
    }
    
    case 'SET_PROCESSING': {
      return {
        ...state,
        processingAction: action.isProcessing
      };
    }
    
    default:
      return state;
  }
}

// Custom hook to use the chess reducer
export function useChessReducer() {
  const [state, dispatch] = useReducer(chessReducer, initialChessState);
  
  // A set of action creators to make dispatching actions easier and type-safe
  const actions = {
    selectPiece: useCallback((position: Position, piece: ChessPiece, validMoves: Position[]) => {
      dispatch({ type: 'SELECT_PIECE', position, piece, validMoves });
    }, []),
    
    deselectPiece: useCallback(() => {
      dispatch({ type: 'DESELECT_PIECE' });
    }, []),
    
    movePiece: useCallback((from: Position, to: Position, notation: string, isPawnMove: boolean, isCapture: boolean) => {
      dispatch({ type: 'MOVE_PIECE', from, to, notation, isPawnMove, isCapture });
    }, []),
    
    handleCastling: useCallback((kingFrom: Position, kingTo: Position, rookFrom: Position, rookTo: Position, kingColor: PieceColor, notation: string) => {
      dispatch({ type: 'HANDLE_CASTLING', kingFrom, kingTo, rookFrom, rookTo, kingColor, notation });
    }, []),
    
    handleEnPassant: useCallback((from: Position, to: Position, capturedPawnPosition: Position, notation: string) => {
      dispatch({ type: 'HANDLE_EN_PASSANT', from, to, capturedPawnPosition, notation });
    }, []),
    
    setPromotionPawn: useCallback((position: Position, color: PieceColor) => {
      dispatch({ type: 'SET_PROMOTION_PAWN', position, color });
    }, []),
    
    promotePawn: useCallback((pieceType: PieceType) => {
      dispatch({ type: 'PROMOTE_PAWN', pieceType });
    }, []),
    
    setGameState: useCallback((gameState: GameState) => {
      dispatch({ type: 'SET_GAME_STATE', gameState });
    }, []),
    
    newGame: useCallback(() => {
      dispatch({ type: 'NEW_GAME' });
    }, []),
    
    toggleInfo: useCallback(() => {
      dispatch({ type: 'TOGGLE_INFO' });
    }, []),
    
    toggleMoveHistory: useCallback(() => {
      dispatch({ type: 'TOGGLE_MOVE_HISTORY' });
    }, []),
    
    toggleAI: useCallback((enabled: boolean) => {
      dispatch({ type: 'TOGGLE_AI', enabled });
    }, []),
    
    setAIThinking: useCallback((isThinking: boolean) => {
      dispatch({ type: 'SET_AI_THINKING', isThinking });
    }, []),
    
    setProcessing: useCallback((isProcessing: boolean) => {
      dispatch({ type: 'SET_PROCESSING', isProcessing });
    }, [])
  };
  
  return { state, actions };
}