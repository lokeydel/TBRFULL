import React, { useState } from 'react';
import { BetType, ChipValue, PlacedBet } from '../types';
import { NUMBER_COLORS, CHIPS } from '../constants';

interface RouletteTableProps {
  onPlaceBet: (bet: Omit<PlacedBet, 'id'>) => void;
  selectedChip: ChipValue;
  placedBets: PlacedBet[];
  onChipSelect: (value: ChipValue) => void;
  onUndo: () => void;
  onClear: () => void;
}

const RouletteTable: React.FC<RouletteTableProps> = ({ 
  onPlaceBet, 
  selectedChip, 
  placedBets,
  onChipSelect,
  onUndo,
  onClear
}) => {
  const [hoveredBet, setHoveredBet] = useState<{ type: string, numbers: number[], label?: string } | null>(null);

  // --- Constants for Grid Generation ---
  // American Roulette: 0, 00, plus 1-36
  // Cell Height: 12 (3rem) mobile, 20 (5rem) desktop
  const CELL_CLASS = "w-10 h-12 sm:w-14 sm:h-20 flex items-center justify-center font-bold text-sm sm:text-xl border border-gray-400 relative select-none transition-colors";
  const OUTSIDE_CELL_CLASS = "flex-1 h-12 sm:h-16 flex items-center justify-center font-bold text-xs sm:text-lg border border-gray-400 relative cursor-pointer uppercase tracking-wider hover:bg-white/10 transition-colors";

  // Zeros need to be exactly 1.5x the height of a cell to span 3 rows (Total 3 units high, each zero 1.5 units)
  // 12 * 1.5 = 18 (4.5rem). 20 * 1.5 = 30 (7.5rem).
  const ZERO_CELL_CLASS = "w-12 sm:w-20 h-[4.5rem] sm:h-[7.5rem] flex items-center justify-center font-bold text-lg sm:text-2xl border border-gray-400 relative cursor-pointer select-none transition-colors bg-feltDark text-white group";

  // Helpers
  const getChipStack = (type: BetType, numbers: number[], label?: string) => {
    const bets = placedBets.filter(b => {
      if (b.type !== type) return false;
      if (label && b.label !== label) return false;
      // Compare sorted arrays for number equality
      if (b.numbers.length !== numbers.length) return false;
      const sortedA = [...b.numbers].sort((x,y) => x-y);
      const sortedB = [...numbers].sort((x,y) => x-y);
      return sortedA.every((val, index) => val === sortedB[index]);
    });

    if (bets.length === 0) return null;

    // Calculate total for display badge
    const total = bets.reduce((sum, b) => sum + b.amount, 0);
    
    // We only render the top N bets visually to prevent massive stacks that block the view
    // Taking the last 10 bets ensures the most recent ones are on top.
    const visibleBets = bets.slice(-10);

    return (
      <div className="absolute z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none w-6 h-6 sm:w-8 sm:h-8">
         {/* Render stack from bottom up */}
         <div className="relative w-full h-full">
            {visibleBets.map((bet, i) => {
                // Find chip style for this specific bet amount
                const chipStyle = CHIPS.find(c => c.value === bet.amount) || CHIPS[0];
                
                return (
                    <div 
                        key={bet.id}
                        className={`
                            absolute left-0 right-0 mx-auto
                            w-6 h-6 sm:w-8 sm:h-8 rounded-full 
                            flex items-center justify-center 
                            shadow-[0_2px_3px_rgba(0,0,0,0.6)]
                            border-[3px] ${chipStyle.color}
                            transition-transform duration-200
                        `}
                        style={{ 
                            top: `-${i * 4}px`, 
                            zIndex: i 
                        }}
                    >
                        <div className={`w-full h-full rounded-full border border-dashed border-white/50 flex items-center justify-center text-[9px] sm:text-[10px] font-black ${chipStyle.color.includes('text-gray-900') ? 'text-gray-900' : 'text-white'}`}>
                            {chipStyle.label}
                        </div>
                    </div>
                );
            })}
            
            {/* Total Value Badge if stack > 1 */}
            {bets.length > 1 && (
                <div 
                   className="absolute left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-[9px] px-1.5 py-0.5 rounded shadow border border-white/20 whitespace-nowrap z-[100]"
                   style={{ top: `-${(visibleBets.length * 4) + 14}px`}}
                >
                    ${total}
                </div>
            )}
         </div>
      </div>
    );
  };

  const handleBet = (type: BetType, numbers: number[], label?: string) => {
    onPlaceBet({ type, numbers, amount: selectedChip, label });
  };

  const isHighlighted = (num: number) => {
    return hoveredBet && hoveredBet.numbers.includes(num);
  };

  // --- Render Functions ---

  // 1. Zeros (0 and 00)
  const renderZeros = () => (
    <div className="flex flex-col relative">
      {/* 0 (Top Half) */}
      <div 
        className={`${ZERO_CELL_CLASS} rounded-tl-lg`}
        onMouseEnter={() => setHoveredBet({ type: BetType.STRAIGHT, numbers: [0], label: '0' })}
        onMouseLeave={() => setHoveredBet(null)}
        onClick={() => handleBet(BetType.STRAIGHT, [0], '0')}
      >
        <span className="group-hover:scale-110 transition-transform relative z-10">0</span>
        {isHighlighted(0) && <div className="absolute inset-0 bg-white/40 z-0" />}
        {getChipStack(BetType.STRAIGHT, [0], '0')}
      </div>

      {/* Split 0-00 Bet - Centered Line */}
      <div 
         className="absolute top-1/2 left-0 right-0 h-8 -mt-4 z-30 flex items-center justify-center cursor-pointer group/split"
         onMouseEnter={() => setHoveredBet({ type: BetType.SPLIT, numbers: [0, 37], label: 'Split' })}
         onMouseLeave={() => setHoveredBet(null)}
         onClick={() => handleBet(BetType.SPLIT, [0, 37], 'Split')}
      >
          {/* Highlight (only on hover) */}
          <div className="w-[80%] h-2 bg-blue-400/80 rounded-full shadow border border-white opacity-0 group-hover/split:opacity-100 transition-opacity" />
          {/* Chip (always visible) */}
          {getChipStack(BetType.SPLIT, [0, 37], 'Split')}
      </div>

      {/* 00 (Bottom Half) */}
      <div 
        className={`${ZERO_CELL_CLASS} rounded-bl-lg`}
        onMouseEnter={() => setHoveredBet({ type: BetType.STRAIGHT, numbers: [37], label: '00' })}
        onMouseLeave={() => setHoveredBet(null)}
        onClick={() => handleBet(BetType.STRAIGHT, [37], '00')} // 37 internally for 00
      >
        <span className="group-hover:scale-110 transition-transform relative z-10">00</span>
        {isHighlighted(37) && <div className="absolute inset-0 bg-white/40 z-0" />}
        {getChipStack(BetType.STRAIGHT, [37], '00')}
      </div>
      
      {/* Basket Bet (Five Number: 0, 00, 1, 2, 3) - Vertical strip between 0s and 1st Column */}
      <div 
         className="absolute -right-3 sm:-right-4 top-0 bottom-0 w-6 sm:w-8 z-20 flex items-center justify-center cursor-pointer group/basket"
         onMouseEnter={() => setHoveredBet({ type: BetType.BASKET, numbers: [0, 37, 1, 2, 3], label: 'Basket' })}
         onMouseLeave={() => setHoveredBet(null)}
         onClick={() => handleBet(BetType.BASKET, [0, 37, 1, 2, 3], 'Basket')}
      >
          {/* Highlight */}
          <div className="h-[90%] w-2 bg-blue-400/60 rounded-full shadow-lg border border-white/50 opacity-0 group-hover/basket:opacity-100 transition-opacity" />
          {/* Chip */}
          {getChipStack(BetType.BASKET, [0, 37, 1, 2, 3], 'Basket')}
      </div>
    </div>
  );

  // 2. Main Grid
  const renderNumberColumn = (colIndex: number) => {
    // Numbers: Top (3rd row), Mid (2nd row), Bot (1st row)
    const topNum = 3 + colIndex * 3;
    const midNum = 2 + colIndex * 3;
    const botNum = 1 + colIndex * 3;
    
    const nums = [topNum, midNum, botNum]; 

    return (
      <div key={colIndex} className="flex flex-col relative">
        
        {/* Street Bet (Top of Column) */}
        <div 
            className="absolute -top-6 sm:-top-8 left-0 right-0 h-6 sm:h-8 z-20 cursor-pointer flex justify-center items-end pb-1 group/street"
            onMouseEnter={() => setHoveredBet({ type: BetType.STREET, numbers: nums, label: 'Street' })}
            onMouseLeave={() => setHoveredBet(null)}
            onClick={() => handleBet(BetType.STREET, nums, 'Street')}
        >
             <div className="w-[80%] h-3 bg-yellow-400/60 rounded-t-lg border border-white/50 opacity-0 group-hover/street:opacity-100 transition-opacity" />
             {getChipStack(BetType.STREET, nums, 'Street')}
        </div>

        {/* Six Line (Double Street) - Top Right Corner Intersection */}
        {colIndex < 11 && (
             <div 
                className="absolute -top-4 sm:-top-6 -right-4 sm:-right-5 w-8 h-8 sm:w-10 sm:h-10 z-30 cursor-pointer flex items-center justify-center group/line"
                onMouseEnter={() => {
                     const nextColNums = [topNum+3, midNum+3, botNum+3];
                     setHoveredBet({ type: BetType.LINE, numbers: [...nums, ...nextColNums], label: 'Line' });
                }}
                onMouseLeave={() => setHoveredBet(null)}
                onClick={() => {
                     const nextColNums = [topNum+3, midNum+3, botNum+3];
                     handleBet(BetType.LINE, [...nums, ...nextColNums], 'Line');
                }}
             >
                <div className="w-5 h-5 bg-purple-400/80 rounded-full shadow border-2 border-white opacity-0 group-hover/line:opacity-100 transition-opacity" />
                {getChipStack(BetType.LINE, [...nums, ...[topNum+3, midNum+3, botNum+3]], 'Line')}
            </div>
        )}

        {nums.map((num, idx) => {
          const color = NUMBER_COLORS[num.toString()];
          const bgColor = color === 'red' ? 'bg-rouletteRed' : 'bg-black';
          
          return (
            <div 
                key={num} 
                className={`${CELL_CLASS} ${bgColor} text-white group`}
                onMouseEnter={() => setHoveredBet({ type: BetType.STRAIGHT, numbers: [num], label: num.toString() })}
                onMouseLeave={() => setHoveredBet(null)}
                onClick={() => handleBet(BetType.STRAIGHT, [num], num.toString())}
            >
                <span className="relative z-10 -rotate-90 sm:rotate-0 drop-shadow-md">{num}</span>
                {isHighlighted(num) && (
                    <div className="absolute inset-0 bg-white/40 pointer-events-none z-0 mix-blend-overlay" />
                )}
                {getChipStack(BetType.STRAIGHT, [num], num.toString())}

                {/* Vertical Split */}
                {idx < 2 && (
                    <div 
                        className="absolute -bottom-3 sm:-bottom-4 left-0 right-0 h-6 sm:h-8 z-20 flex items-center justify-center cursor-pointer group/vsplit"
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredBet({ type: BetType.SPLIT, numbers: [num, nums[idx+1]], label: 'Split' }); }}
                        onMouseLeave={(e) => { e.stopPropagation(); setHoveredBet(null); }}
                        onClick={(e) => { e.stopPropagation(); handleBet(BetType.SPLIT, [num, nums[idx+1]], 'Split'); }}
                    >
                        <div className="w-[60%] h-2 bg-blue-400/80 rounded-full shadow border border-white opacity-0 group-hover/vsplit:opacity-100 transition-opacity" />
                        {getChipStack(BetType.SPLIT, [num, nums[idx+1]], 'Split')}
                    </div>
                )}

                {/* Horizontal Split */}
                {colIndex < 11 && (
                    <div 
                        className="absolute top-0 bottom-0 -right-3 sm:-right-4 w-6 sm:w-8 z-20 flex items-center justify-center cursor-pointer group/hsplit"
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredBet({ type: BetType.SPLIT, numbers: [num, num+3], label: 'Split' }); }}
                        onMouseLeave={(e) => { e.stopPropagation(); setHoveredBet(null); }}
                        onClick={(e) => { e.stopPropagation(); handleBet(BetType.SPLIT, [num, num+3], 'Split'); }}
                    >
                        <div className="h-[60%] w-2 bg-blue-400/80 rounded-full shadow border border-white opacity-0 group-hover/hsplit:opacity-100 transition-opacity" />
                        {getChipStack(BetType.SPLIT, [num, num+3], 'Split')}
                    </div>
                )}

                {/* Corner */}
                {idx < 2 && colIndex < 11 && (
                     <div 
                        className="absolute -bottom-5 -right-5 sm:-bottom-6 sm:-right-6 w-10 h-10 sm:w-12 sm:h-12 z-30 flex items-center justify-center cursor-pointer group/corner"
                        onMouseEnter={(e) => { 
                            e.stopPropagation(); 
                            setHoveredBet({ type: BetType.CORNER, numbers: [num, nums[idx+1], num+3, nums[idx+1]+3], label: 'Corner' }); 
                        }}
                        onMouseLeave={(e) => { e.stopPropagation(); setHoveredBet(null); }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            handleBet(BetType.CORNER, [num, nums[idx+1], num+3, nums[idx+1]+3], 'Corner'); 
                        }}
                    >
                        <div className="w-5 h-5 bg-green-400/80 rounded-full shadow border-2 border-white opacity-0 group-hover/corner:opacity-100 transition-opacity" />
                        {getChipStack(BetType.CORNER, [num, nums[idx+1], num+3, nums[idx+1]+3], 'Corner')}
                    </div>
                )}
            </div>
          );
        })}
      </div>
    );
  };

  // 3. Right Side "2 to 1"
  const renderTwoToOnes = () => {
    const topNums = Array.from({length: 12}, (_, i) => 3 + i*3);
    const midNums = Array.from({length: 12}, (_, i) => 2 + i*3);
    const botNums = Array.from({length: 12}, (_, i) => 1 + i*3);

    return (
    <div className="flex flex-col border-r border-t border-b border-gray-400">
       {/* 2 to 1 for Top Row (remainder 0) */}
       <div 
         className={`${CELL_CLASS} text-white border-l-0 border-white bg-transparent hover:bg-white/10`}
         onMouseEnter={() => setHoveredBet({ type: BetType.COLUMN, numbers: topNums, label: '2 to 1 (Top)' })}
         onMouseLeave={() => setHoveredBet(null)}
         onClick={() => handleBet(BetType.COLUMN, topNums, '2 to 1 (Top)')}
       >
         <span className="-rotate-90 whitespace-nowrap text-xs sm:text-sm">2 to 1</span>
         {hoveredBet?.label === '2 to 1 (Top)' && <div className="absolute inset-0 bg-white/20" />}
         {getChipStack(BetType.COLUMN, topNums, '2 to 1 (Top)')}
       </div>
       
       {/* 2 to 1 for Mid Row (remainder 2) */}
       <div 
         className={`${CELL_CLASS} text-white border-l-0 border-white bg-transparent hover:bg-white/10`}
         onMouseEnter={() => setHoveredBet({ type: BetType.COLUMN, numbers: midNums, label: '2 to 1 (Mid)' })}
         onMouseLeave={() => setHoveredBet(null)}
         onClick={() => handleBet(BetType.COLUMN, midNums, '2 to 1 (Mid)')}
       >
         <span className="-rotate-90 whitespace-nowrap text-xs sm:text-sm">2 to 1</span>
         {hoveredBet?.label === '2 to 1 (Mid)' && <div className="absolute inset-0 bg-white/20" />}
         {getChipStack(BetType.COLUMN, midNums, '2 to 1 (Mid)')}
       </div>

       {/* 2 to 1 for Bot Row (remainder 1) */}
       <div 
         className={`${CELL_CLASS} text-white border-l-0 border-white bg-transparent hover:bg-white/10`}
         onMouseEnter={() => setHoveredBet({ type: BetType.COLUMN, numbers: botNums, label: '2 to 1 (Bot)' })}
         onMouseLeave={() => setHoveredBet(null)}
         onClick={() => handleBet(BetType.COLUMN, botNums, '2 to 1 (Bot)')}
       >
         <span className="-rotate-90 whitespace-nowrap text-xs sm:text-sm">2 to 1</span>
         {hoveredBet?.label === '2 to 1 (Bot)' && <div className="absolute inset-0 bg-white/20" />}
         {getChipStack(BetType.COLUMN, botNums, '2 to 1 (Bot)')}
       </div>
    </div>
  );
  };

  // 4. Bottom Outside Bets
  const renderOutsideBets = () => {
    return (
      <div className="w-full">
         {/* Row 1: Dozens - Attached to grid */}
         <div className="flex w-full">
            {['1st 12', '2nd 12', '3rd 12'].map((label, idx) => {
                const start = idx * 12 + 1;
                const nums = Array.from({length: 12}, (_, i) => start + i);
                
                return (
                <div 
                    key={label}
                    className={`${OUTSIDE_CELL_CLASS} text-white`}
                    onMouseEnter={() => setHoveredBet({ type: BetType.DOZEN, numbers: nums, label })}
                    onMouseLeave={() => setHoveredBet(null)}
                    onClick={() => handleBet(BetType.DOZEN, nums, label)}
                >
                    {label}
                    {hoveredBet?.label === label && <div className="absolute inset-0 bg-white/20" />}
                    {getChipStack(BetType.DOZEN, nums, label)}
                </div>
            )})}
         </div>

         {/* Row 2: Even Money - Attached to Dozens */}
         <div className="flex w-full">
             {[
                 { label: '1-18', type: BetType.HIGH_LOW, nums: Array.from({length:18}, (_,i)=>i+1) },
                 { label: 'Even', type: BetType.EVEN_ODD, nums: [] },
                 { label: 'Red', type: BetType.RED_BLACK, nums: [], bg: 'bg-rouletteRed' },
                 { label: 'Black', type: BetType.RED_BLACK, nums: [], bg: 'bg-black' },
                 { label: 'Odd', type: BetType.EVEN_ODD, nums: [] },
                 { label: '19-36', type: BetType.HIGH_LOW, nums: Array.from({length:18}, (_,i)=>i+19) }
             ].map((bet) => (
                 <div 
                    key={bet.label}
                    className={`${OUTSIDE_CELL_CLASS} ${bet.bg || 'bg-transparent'} text-white`}
                    onMouseEnter={() => setHoveredBet({ type: bet.type, numbers: bet.nums, label: bet.label })}
                    onMouseLeave={() => setHoveredBet(null)}
                    onClick={() => handleBet(bet.type, bet.nums, bet.label)}
                 >
                    {bet.label === 'Red' || bet.label === 'Black' ? (
                         <div className={`w-6 h-6 sm:w-8 sm:h-8 rotate-45 border-2 border-white ${bet.label === 'Red' ? 'bg-rouletteRed' : 'bg-black'}`}></div>
                    ) : bet.label}
                    
                    {hoveredBet?.label === bet.label && <div className="absolute inset-0 bg-white/20" />}
                    {getChipStack(bet.type, bet.nums, bet.label)}
                 </div>
             ))}
         </div>
      </div>
    );
  };

  return (
    <div className="bg-felt p-6 sm:p-8 rounded-3xl shadow-2xl border-8 border-feltDark inline-block select-none relative">
      <div className="flex items-start">
            
        {/* Left: Zeros (0 & 00) */}
        {renderZeros()}

        {/* Center Block: Numbers & Outside Bets */}
        <div className="flex flex-col">
            {/* Top: Numbers 1-36 */}
            <div className="flex">
                {Array.from({ length: 12 }).map((_, i) => renderNumberColumn(i))}
            </div>

            {/* Bottom: Outside Bets */}
            {renderOutsideBets()}
        </div>

        {/* Right: 2 to 1 */}
        {renderTwoToOnes()}
      </div>

      {/* Chip Controls - Directly under table with minimal gap */}
      <div className="mt-4 pt-4 border-t border-white/10">
         <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
             {/* Chips */}
             <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center bg-feltDark/30 p-3 rounded-2xl border border-white/5">
                 {CHIPS.map((chip) => (
                      <button
                        key={chip.value}
                        onClick={() => onChipSelect(chip.value)}
                        className={`
                            w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center 
                            font-black text-sm sm:text-lg shadow-[0_2px_4px_rgba(0,0,0,0.5)] 
                            transition-all transform hover:-translate-y-1 active:scale-95
                            border-[3px] ${chip.color} 
                            ${selectedChip === chip.value ? 'ring-4 ring-yellow-400 scale-110 z-10' : 'opacity-90 hover:opacity-100'}
                        `}
                      >
                        <div className="w-[85%] h-[85%] rounded-full border border-dashed border-white/40 flex items-center justify-center">
                            {chip.label}
                        </div>
                      </button>
                   ))}
             </div>

             {/* Action Buttons */}
             <div className="flex gap-3">
                 <button onClick={onUndo} className="px-6 py-3 rounded-lg bg-gray-700/80 hover:bg-gray-600 text-white font-bold uppercase text-xs sm:text-sm transition-colors border border-gray-500 backdrop-blur-sm shadow-lg">
                    Undo
                 </button>
                 <button onClick={onClear} className="px-6 py-3 rounded-lg bg-red-900/80 hover:bg-red-800 text-red-100 font-bold uppercase text-xs sm:text-sm transition-colors border border-red-700 backdrop-blur-sm shadow-lg">
                    Clear Table
                 </button>
             </div>
         </div>
      </div>

    </div>
  );
};

export default RouletteTable;