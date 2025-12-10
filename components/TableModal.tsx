import React, { useState, useEffect } from 'react';
import RouletteTable from './RouletteTable';
import { PlacedBet, ChipValue } from '../types';

interface TableModalProps {
  isOpen: boolean;
  initialBets: PlacedBet[];
  onClose: () => void;
  onSave: (bets: PlacedBet[]) => void;
  startBankroll: number;
  onInteraction?: (x: number, y: number) => void;
}

const TableModal: React.FC<TableModalProps> = ({ 
  isOpen, 
  initialBets, 
  onClose, 
  onSave, 
  startBankroll,
  onInteraction
}) => {
  const [tempBets, setTempBets] = useState<PlacedBet[]>([]);
  const [selectedChip, setSelectedChip] = useState<ChipValue>(ChipValue.FIVE);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempBets([...initialBets]);
    }
  }, [isOpen, initialBets]);

  if (!isOpen) return null;

  const handlePlaceBet = (bet: Omit<PlacedBet, 'id'>) => {
    const currentTotal = tempBets.reduce((sum, b) => sum + b.amount, 0);
    if ((startBankroll - currentTotal) < bet.amount) {
        alert("Insufficient simulation bankroll for this bet.");
        return;
    }
    const newBet = { ...bet, id: Math.random().toString(36).substr(2, 9) };
    setTempBets([...tempBets, newBet]);
  };

  const currentTotal = tempBets.reduce((sum, b) => sum + b.amount, 0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onInteraction) {
      onInteraction(e.clientX, e.clientY);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn"
      onMouseDown={handleMouseDown}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col"
        onMouseDown={(e) => {
             // Allow bubbling to parent for interaction handling
             // e.stopPropagation(); 
        }}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">Configure Base Bet</h2>
            <p className="text-xs text-gray-400">Place chips to define your strategy's starting point</p>
          </div>
          <div className="text-right">
             <div className="text-xs text-gray-500 uppercase">Total Wager</div>
             <div className="text-xl font-mono text-gold">${currentTotal}</div>
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="overflow-auto p-4 md:p-8 bg-black/20 flex-1 flex justify-center">
            <div className="scale-[0.8] sm:scale-100 origin-top">
                <RouletteTable 
                    onPlaceBet={handlePlaceBet}
                    selectedChip={selectedChip}
                    placedBets={tempBets}
                    onChipSelect={setSelectedChip}
                    onUndo={() => setTempBets(prev => prev.slice(0, -1))}
                    onClear={() => setTempBets([])}
                />
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-800 bg-gray-800 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-lg border border-gray-600 text-gray-300 font-bold uppercase text-sm hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(tempBets)}
            className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold uppercase text-sm shadow-lg shadow-green-900/50 transition-all transform hover:scale-105"
          >
            Accept Bets
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableModal;