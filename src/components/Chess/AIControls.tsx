'use client';

import React, { useState } from 'react';
import { useChessAI } from '@/hooks/useChessAI';
import type { DifficultyLevel } from '@/types/chess';

interface AIControlsProps {
  onGetHint: () => void;
  isAIEnabled: boolean;
  setAIEnabled: (enabled: boolean) => void;
  isAIThinking: boolean;
}

/**
 * AI Controls component for Chess game
 */
export default function AIControls({
  onGetHint,
  isAIEnabled,
  setAIEnabled,
  isAIThinking
}: AIControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  
  const { 
    difficulty, 
    setDifficulty, 
    loading, 
    initialized, 
    error 
  } = useChessAI({
    autoInit: true
  });
  
  const handleDifficultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("Changing difficulty to:", e.target.value);
    setDifficulty(e.target.value as DifficultyLevel);
  };
  
  function handleToggleAI() {
    console.log("AI button clicked, current state:", isAIEnabled);
    setAIEnabled(!isAIEnabled);
  }
  
  const handleGetHint = () => {
    console.log("Get hint clicked");
    onGetHint();
  };
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <button
          className={`px-4 py-2 rounded-lg transition-colors duration-200 shadow-lg 
            ${isAIEnabled 
              ? 'bg-amber-500 hover:bg-amber-400' 
              : 'bg-amber-700 hover:bg-amber-600'} 
            text-white font-medium`}
          onClick={handleToggleAI}
          disabled={loading || isAIThinking}
        >
          {isAIEnabled ? 'AI: ON' : 'AI: OFF'}
        </button>
        
        <button
          className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg 
                   transition-colors duration-200 shadow-lg"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="AI Settings"
        >
          ⚙️
        </button>
        
        <button
          className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg 
                   transition-colors duration-200 shadow-lg"
          onClick={handleGetHint}
          disabled={loading || isAIThinking}
          aria-label="Get Hint"
        >
          💡
        </button>
      </div>
      
      {showSettings && (
        <div className="p-3 bg-amber-800/70 rounded-lg border border-amber-600/30">
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between text-amber-200">
              <span>Difficulty:</span>
              <select 
                value={difficulty}
                onChange={handleDifficultyChange}
                className="ml-2 bg-amber-700 text-white px-2 py-1 rounded border border-amber-500"
                disabled={loading || isAIThinking}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="master">Master</option>
              </select>
            </label>
            
            <div className="text-xs text-amber-300 mt-1">
              {loading && <span className="animate-pulse">Loading Stockfish engine...</span>}
              {error && (
                <div className="text-red-400">
                  <div className="font-semibold mb-1">AI Error:</div>
                  <div>{error}</div>
                  <button 
                    className="mt-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs"
                    onClick={() => window.location.reload()}
                  >
                    Reload Page
                  </button>
                </div>
              )}
              {initialized && !loading && !error && 
                <span className="text-green-400">✅ Stockfish AI ready</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}