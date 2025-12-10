

import React, { useState, useRef, useEffect } from 'react';
import { StrategyNode, ProgressionType, PlacedBet, BetType, MartingaleLimitType, RepeatUntilType } from '../types';
import { NUMBER_COLORS, PAYOUTS } from '../constants';

interface StrategyFlowBuilderProps {
  rootNode: StrategyNode;
  startBankroll: number;
  onUpdateNode: (nodeId: string, updates: Partial<StrategyNode>) => void;
  onCreateNode: (parentId: string, type: 'win' | 'loss', initialData?: Partial<StrategyNode>, openTable?: boolean) => void;
  onOpenTable: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  canvasOffset: { x: number, y: number };
  zoom: number;
}

const ACTION_OPTIONS: { type: ProgressionType, label: string }[] = [
    { type: 'reset', label: 'Reset to Start' },
    { type: 'repeat_until', label: 'Repeat Bet Until...' },
    { type: 'double', label: 'Double Bet (2x)' },
    { type: 'triple', label: 'Triple Bet (3x)' },
    { type: 'martingale', label: 'Martingale (Custom)' },
    { type: 'add_unit', label: 'Add 1 Unit (+1)' },
    { type: 'subtract_unit', label: 'Subtract 1 Unit (-1)' },
    { type: 'same_bet', label: 'Repeat Same Bet' },
    { type: 'wait_spins', label: 'Wait X Spins' },
    { type: 'custom_bet', label: 'Custom Bet' },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export const isNodeValid = (node: StrategyNode): boolean => {
    if (node.type !== 'reset') {
        if (!node.children.win || !node.children.loss) {
            return false;
        }
    }

    switch (node.type) {
        case 'start_immediately':
            return !!(node.bets && node.bets.length > 0);
        case 'custom_bet':
            return !!(node.bets && node.bets.length > 0);
        case 'wait_spins':
            return !!(node.value && node.value > 0);
        case 'wait_condition':
            return !!node.condition;
        case 'martingale':
            if (!node.martingaleLimitType) return false;
            if (node.martingaleLimitType !== 'until_bankrupt' && (!node.martingaleLimitValue || node.martingaleLimitValue <= 0)) return false;
            return true;
        case 'repeat_until':
            if (!node.repeatUntilType) return false;
            if (!node.repeatUntilValue || node.repeatUntilValue <= 0) return false;
            return true;
        default:
            return true;
    }
};

interface RenderNode {
    data: StrategyNode;
    parentId: string | null;
    branchType: 'root' | 'win' | 'loss';
    x: number;
    y: number;
    isVirtual: boolean;
    simulatedBankroll: number;
    activeBetAmount: number;
    isTerminal: boolean; 
}

interface RenderConnection {
    id: string;
    sourceId: string;
    targetId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    type: 'win' | 'loss';
    isVirtual: boolean;
    isTerminal: boolean; 
    isComplete?: boolean;
}

interface NodeCardProps {
    node: StrategyNode;
    renderData: RenderNode;
    startBankroll: number;
    onUpdateNode: (nodeId: string, updates: Partial<StrategyNode>) => void;
    onCreateNode: (parentId: string, type: 'win' | 'loss', initialData?: Partial<StrategyNode>, openTable?: boolean) => void;
    onOpenTable: (nodeId: string) => void;
    onStartDrag: (e: React.MouseEvent, nodeId: string) => void;
}

// --- Helper for Payout Estimation ---
const calculateEstimatedOutcomes = (bets: PlacedBet[], multiplier: number) => {
    const totalWager = bets.reduce((s, b) => s + (b.amount * multiplier), 0);
    let maxGrossPayout = 0;
    
    // Check all 38 American Roulette outcomes (0-36, 37=00)
    for (let i = 0; i <= 37; i++) {
        const resultVal = i; 
        const isZeroOrDoubleZero = (resultVal === 0 || resultVal === 37);
        let currentSpinPayout = 0;
        
        bets.forEach(bet => {
            let isHit = false;
            
            // STRICT AMERICAN RULES
            if (bet.type === BetType.BASKET) {
                // 0, 00(37), 1, 2, 3
                isHit = [0, 37, 1, 2, 3].includes(resultVal);
            }
            else if (bet.type === BetType.RED_BLACK) {
                if (isZeroOrDoubleZero) isHit = false;
                else {
                    const color = NUMBER_COLORS[resultVal === 37 ? '00' : resultVal.toString()];
                    isHit = color === bet.label?.toLowerCase();
                }
            }
            else if (bet.type === BetType.EVEN_ODD) {
                 if (isZeroOrDoubleZero) isHit = false;
                 else {
                     const isEven = (resultVal % 2 === 0);
                     isHit = (bet.label === 'Even' && isEven) || (bet.label === 'Odd' && !isEven);
                 }
            }
            else if (bet.type === BetType.HIGH_LOW) {
                if (isZeroOrDoubleZero) isHit = false;
                else {
                    if (bet.label === '1-18' && resultVal <= 18) isHit = true;
                    if (bet.label === '19-36' && resultVal >= 19) isHit = true;
                }
            }
            else if (bet.type === BetType.DOZEN) {
                 if (isZeroOrDoubleZero) isHit = false;
                 else {
                     if (bet.label === '1st 12' && resultVal <= 12) isHit = true;
                     else if (bet.label === '2nd 12' && resultVal >= 13 && resultVal <= 24) isHit = true;
                     else if (bet.label === '3rd 12' && resultVal >= 25) isHit = true;
                 }
            }
            else if (bet.type === BetType.COLUMN) {
                if (isZeroOrDoubleZero) isHit = false;
                else {
                    if (bet.numbers.length > 0) isHit = bet.numbers.includes(resultVal);
                    else {
                        if (bet.label === '2 to 1 (Bot)' && resultVal % 3 === 1) isHit = true;
                        else if (bet.label === '2 to 1 (Mid)' && resultVal % 3 === 2) isHit = true;
                        else if (bet.label === '2 to 1 (Top)' && resultVal !== 0 && resultVal !== 37 && resultVal % 3 === 0) isHit = true;
                    }
                }
            }
            else {
                // Inside Bets
                if (bet.numbers.includes(resultVal)) isHit = true;
            }

            if (isHit) {
                let pm = 1;
                switch(bet.type) {
                    case BetType.STRAIGHT: pm = 35; break;
                    case BetType.SPLIT: pm = 17; break;
                    case BetType.STREET: pm = 11; break;
                    case BetType.CORNER: pm = 8; break;
                    case BetType.BASKET: pm = 6; break; // Basket
                    case BetType.LINE: pm = 5; break;
                    case BetType.COLUMN: pm = 2; break;
                    case BetType.DOZEN: pm = 2; break;
                    default: pm = 1; break;
                }
                // Gross return: Stake + (Stake * Multiplier)
                currentSpinPayout += (bet.amount * multiplier) + (bet.amount * multiplier * pm);
            }
        });
        
        if (currentSpinPayout > maxGrossPayout) maxGrossPayout = currentSpinPayout;
    }

    return {
        winDelta: maxGrossPayout - totalWager, // Net win
        lossDelta: -totalWager, 
        totalWager
    };
};

const NodeCard: React.FC<NodeCardProps> = ({ 
    node, 
    renderData,
    startBankroll,
    onUpdateNode,
    onCreateNode,
    onOpenTable,
    onStartDrag
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const subNodeButtonRef = useRef<HTMLButtonElement>(null);
    
    // Header Edit State
    const [isEditingHeader, setIsEditingHeader] = useState(false);
    const [headerInput, setHeaderInput] = useState("");

    const { branchType, isVirtual, simulatedBankroll, activeBetAmount, isTerminal } = renderData;
    const isRoot = branchType === 'root';
    const hasBets = node.bets && node.bets.length > 0;
    
    const isWaitNode = node.type === 'wait_spins' || node.type === 'wait_condition';
    
    const isResetLoop = isTerminal && !isVirtual;
    const isFullySet = !!(node.children.win && node.children.loss) && !isResetLoop;
    const isValid = isVirtual ? true : isNodeValid(node);

    const subActionType = node.bets && node.bets.length > 0 ? 'custom_bet' : (node.postWaitAction || 'same_bet');
    const subActionLabel = node.bets && node.bets.length > 0 ? 'Custom Bet' : (ACTION_OPTIONS.find(o => o.type === subActionType)?.label || 'Action');

    const isWinReset = node.children.win?.type === 'reset';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
                subNodeButtonRef.current && !subNodeButtonRef.current.contains(event.target as Node)
            ) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleActionSelect = (type: ProgressionType, label: string) => {
        setShowMenu(false);
        const typesPreservingBets = ['custom_bet', 'wait_spins', 'wait_condition', 'start_immediately', 'repeat_until'];
        const shouldClearBets = !typesPreservingBets.includes(type);

        if (isVirtual && renderData.parentId && branchType !== 'root') {
            onCreateNode(renderData.parentId, branchType, { 
                type, 
                label,
                x: renderData.x,
                y: renderData.y,
                martingaleLimitType: type === 'martingale' ? 'spin_count' : undefined,
                martingaleLimitValue: type === 'martingale' ? 5 : undefined,
                repeatUntilType: type === 'repeat_until' ? 'spins' : undefined,
                repeatUntilValue: type === 'repeat_until' ? 10 : undefined
            }, false);
        } else {
            if (isWaitNode) {
                onUpdateNode(node.id, {
                    postWaitAction: type,
                    bets: shouldClearBets ? [] : node.bets
                });
            } else {
                onUpdateNode(node.id, { 
                    type, 
                    label,
                    bets: shouldClearBets ? [] : node.bets,
                    martingaleLimitType: type === 'martingale' ? 'spin_count' : undefined,
                    martingaleLimitValue: type === 'martingale' ? 5 : undefined,
                    repeatUntilType: type === 'repeat_until' ? 'spins' : undefined,
                    repeatUntilValue: type === 'repeat_until' ? 10 : undefined
                });
            }
        }
    };

    const handleToggleWinReset = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isVirtual) return;

        let newWinNode = node.children.win;
        if (isWinReset) {
            newWinNode = null;
        } else {
            newWinNode = {
                id: generateId(),
                type: 'reset',
                label: 'Reset to Start',
                children: { win: null, loss: null }
            };
        }

        onUpdateNode(node.id, {
            children: {
                ...node.children,
                win: newWinNode
            }
        });
    };

    const handleBetClick = () => {
        if (isVirtual && renderData.parentId && branchType !== 'root') {
            onCreateNode(renderData.parentId, branchType, { 
                type: 'custom_bet', 
                label: 'Custom Bet',
                x: renderData.x,
                y: renderData.y
            }, true);
        } else {
            onOpenTable(node.id);
        }
    };

    // Header Editing Handlers
    const defaultHeaderText = !isValid && !isRoot ? 'NEEDS ATTENTION' : (isRoot ? 'Start Sequence' : (branchType === 'win' ? 'On Win' : 'On Loss'));
    const currentTitle = node.title || defaultHeaderText;

    const handleHeaderClick = (e: React.MouseEvent) => {
        if (isVirtual) return;
        e.stopPropagation(); // Prevent drag start
        setIsEditingHeader(true);
        setHeaderInput(node.title || defaultHeaderText);
    };

    const handleHeaderBlur = () => {
        setIsEditingHeader(false);
        const trimmed = headerInput.trim();
        // If empty or same as default, clear the title to fallback to default logic
        if (trimmed && trimmed !== defaultHeaderText) {
             onUpdateNode(node.id, { title: trimmed });
        } else {
             onUpdateNode(node.id, { title: undefined });
        }
    };

    const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleHeaderBlur();
        }
        if (e.key === 'Escape') {
            setIsEditingHeader(false);
        }
        e.stopPropagation(); // Prevent other hotkeys
    };

    let borderColor = 'border-[3px] border-gray-500 shadow-[0_0_20px_rgba(107,114,128,0.4)]'; 

    if (!isValid && !isRoot) {
        borderColor = 'border-[3px] animate-fast-flash shadow-[0_0_30px_red]';
    } else if (isResetLoop) {
        borderColor = 'border-[3px] border-gray-700 bg-gray-900'; 
    } else if (isFullySet) {
        if (branchType === 'win') borderColor = 'border-[3px] border-green-800/60 shadow-[0_0_10px_rgba(74,222,128,0.1)]';
        else if (branchType === 'loss') borderColor = 'border-[3px] border-red-800/60 shadow-[0_0_10px_rgba(248,113,113,0.1)]';
        else if (isRoot) borderColor = 'border-[3px] border-yellow-800/60 shadow-[0_0_10px_rgba(250,204,21,0.1)]';
    } else {
        if (branchType === 'win') borderColor = 'border-[3px] border-green-400 shadow-[0_0_35px_rgba(74,222,128,0.9)]';
        else if (branchType === 'loss') borderColor = 'border-[3px] border-red-400 shadow-[0_0_35px_rgba(248,113,113,0.9)]';
        else if (isRoot) borderColor = 'border-[3px] border-yellow-400 shadow-[0_0_35px_rgba(250,204,21,0.9)]';
    }

    const subNodeBorderColor = borderColor.replace('border-[3px]', 'border-[2px]').replace(/shadow-\[.*\]/, '');

    let headerBg = 'bg-gray-800';
    let headerText = 'text-gray-300';
    if (!isValid && !isRoot) { headerBg = 'bg-red-900'; headerText = 'text-white font-bold animate-pulse'; }
    else if (isResetLoop) { headerBg = 'bg-gray-800'; headerText = 'text-gray-500'; }
    else if (branchType === 'win') { headerBg = 'bg-green-900/40'; headerText = 'text-green-300'; }
    else if (branchType === 'loss') { headerBg = 'bg-red-900/40'; headerText = 'text-red-300'; }
    else if (isRoot) { headerBg = 'bg-yellow-900/30'; headerText = 'text-yellow-400'; }

    return (
        <div 
            className={`absolute flex flex-col items-center cursor-move transition-transform duration-100 ${isVirtual ? 'opacity-90' : ''} ${showMenu ? 'z-[100]' : 'z-20'} pointer-events-auto`}
            style={{ 
                left: renderData.x, 
                top: renderData.y,
                transform: 'translate(-50%, 0)',
                width: '240px'
            }}
            onMouseDown={(e) => onStartDrag(e, node.id)}
        >
             {!isRoot && (
                <div className={`absolute top-[40px] -left-2 w-4 h-4 rounded-full border-2 border-[#1a1a1a] z-20 ${branchType === 'win' ? 'bg-green-400 shadow-[0_0_15px_#4ade80]' : (branchType === 'loss' ? 'bg-red-400 shadow-[0_0_15px_#f87171]' : 'bg-gray-400')}`} />
            )}
            
            {!isResetLoop && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur px-3 py-1.5 rounded-full border border-gray-700 shadow-lg whitespace-nowrap z-10">
                    <span className="text-[10px] text-gray-500 font-bold uppercase mr-2">Sim Bankroll</span>
                    <span className="font-mono font-bold text-2xl text-green-400">${simulatedBankroll}</span>
                </div>
            )}

            {showMenu && (
                <div 
                    ref={menuRef}
                    className="absolute left-[100%] top-0 ml-4 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-[100] overflow-hidden animate-menu-roll-out origin-top-left"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 bg-black/40 text-[10px] text-gray-400 font-bold uppercase border-b border-gray-700">Select Logic</div>
                    
                    {!isVirtual && !isResetLoop && (
                        <div 
                            className="px-4 py-2 flex items-center justify-between hover:bg-white/5 border-b border-gray-700/50 cursor-pointer group select-none"
                            onClick={handleToggleWinReset}
                        >
                            <span className="text-xs font-bold text-gray-300 group-hover:text-white">Win Resets</span>
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${isWinReset ? 'bg-green-500' : 'bg-gray-600'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${isWinReset ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </div>
                    )}

                    {ACTION_OPTIONS.map(opt => (
                        <button
                            key={opt.type}
                            onClick={() => handleActionSelect(opt.type, opt.label)}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-gray-200 hover:bg-white/10 border-b border-gray-700/50 last:border-0 transition-colors"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            <div className={`w-full flex flex-col bg-[#1a1a1a] ${borderColor} rounded-xl overflow-hidden relative z-10`}>
                <div className={`w-full p-2 text-center border-b border-white/10 ${headerBg}`}>
                    {isEditingHeader ? (
                         <input 
                            autoFocus
                            type="text"
                            className={`w-full bg-transparent text-center text-[11px] uppercase font-black tracking-widest outline-none ${headerText.replace('pointer-events-none', '')} placeholder-white/30`}
                            value={headerInput}
                            onChange={(e) => setHeaderInput(e.target.value)}
                            onBlur={handleHeaderBlur}
                            onKeyDown={handleHeaderKeyDown}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder={defaultHeaderText}
                         />
                    ) : (
                        <div 
                            className={`text-[11px] uppercase font-black tracking-widest select-none ${headerText.replace('pointer-events-none', '')} drop-shadow-md cursor-text hover:underline decoration-white/20 underline-offset-4`}
                            onClick={handleHeaderClick}
                            title="Click to rename step"
                        >
                            {currentTitle}
                            {isVirtual && " (Drag to Create)"}
                        </div>
                    )}
                </div>

                <div className={`p-4 w-full flex flex-col ${isWaitNode ? 'min-h-[60px]' : 'min-h-[100px]'} justify-between`} onMouseDown={(e) => e.stopPropagation()}>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        {isResetLoop ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="text-gray-600 font-black text-sm uppercase tracking-widest">Loop To Start</span>
                            </div>
                        ) : (
                            !isVirtual && (
                                <div className="flex flex-col items-center justify-center w-full">
                                    <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-0.5">
                                        {!isWaitNode ? (hasBets || node.type === 'custom_bet' ? 'Active Wager' : 'Action') : 'Logic'}
                                    </span>
                                    
                                    {!isWaitNode && (hasBets || activeBetAmount > 0) ? (
                                        <div className="text-green-400 font-mono font-bold text-lg text-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                                            ${activeBetAmount}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            {node.label !== 'Reset to Start' && (
                                                <span className={`font-black text-sm text-center uppercase tracking-wider ${isVirtual ? 'text-gray-300' : 'text-white'}`}>
                                                    {node.label}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    
                                    {node.type === 'wait_spins' && !isVirtual && (
                                        <div className="flex items-center gap-1 bg-gray-800 rounded px-1 border border-gray-700 mt-1 shadow-inner justify-center">
                                            <span className="text-[9px] text-gray-400 font-bold">Spins:</span>
                                            <input 
                                                type="number" 
                                                className="w-10 bg-transparent text-center font-mono text-white text-sm outline-none font-bold"
                                                value={node.value || 0}
                                                onChange={(e) => onUpdateNode(node.id, { value: parseInt(e.target.value) || 0 })}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    )}

                                    {node.type === 'repeat_until' && !isVirtual && (
                                        <div className="w-full mt-2 flex flex-col gap-1">
                                            <select 
                                                className="w-full bg-gray-800 text-[9px] text-white border border-gray-600 rounded px-1 py-0.5 outline-none"
                                                value={node.repeatUntilType || 'spins'}
                                                onChange={(e) => onUpdateNode(node.id, { repeatUntilType: e.target.value as RepeatUntilType })}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <option value="spins">X Spins</option>
                                                <option value="wins">X Wins</option>
                                                <option value="profit_target">Profit Target (+ $X)</option>
                                                <option value="loss_limit">Loss Limit (- $X)</option>
                                            </select>
                                            
                                            <div className="flex items-center gap-1 bg-gray-800 rounded px-1 border border-gray-700 shadow-inner justify-center">
                                                <span className="text-[9px] text-gray-400 font-bold">Value:</span>
                                                <input 
                                                    type="number" 
                                                    className="w-12 bg-transparent text-center font-mono text-white text-sm outline-none font-bold"
                                                    value={node.repeatUntilValue || 0}
                                                    onChange={(e) => onUpdateNode(node.id, { repeatUntilValue: parseInt(e.target.value) || 0 })}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {node.type === 'martingale' && !isVirtual && (
                                        <div className="w-full mt-2 flex flex-col gap-1">
                                            <select 
                                                className="w-full bg-gray-800 text-[9px] text-white border border-gray-600 rounded px-1 py-0.5 outline-none"
                                                value={node.martingaleLimitType || 'until_bankrupt'}
                                                onChange={(e) => onUpdateNode(node.id, { martingaleLimitType: e.target.value as MartingaleLimitType })}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <option value="until_bankrupt">Until Win or Bankrupt</option>
                                                <option value="spin_count">For X Spins</option>
                                                <option value="profit_target">Until Profit $X</option>
                                            </select>
                                            
                                            {node.martingaleLimitType !== 'until_bankrupt' && (
                                                <div className="flex items-center gap-1 bg-gray-800 rounded px-1 border border-gray-700 shadow-inner justify-center">
                                                    <span className="text-[9px] text-gray-400 font-bold">Value:</span>
                                                    <input 
                                                        type="number" 
                                                        className="w-12 bg-transparent text-center font-mono text-white text-sm outline-none font-bold"
                                                        value={node.martingaleLimitValue || 0}
                                                        onChange={(e) => onUpdateNode(node.id, { martingaleLimitValue: parseInt(e.target.value) || 0 })}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                    
                    {!isWaitNode && (
                         <>
                            <div className="mb-4" />
                            <div className="flex gap-3">
                                <button 
                                    onClick={handleBetClick}
                                    className="flex-1 py-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all border-[2px] shadow-lg text-white bg-gray-800 border-green-500 hover:bg-gray-700 hover:border-green-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <span className="text-[9px] font-black uppercase tracking-tight text-white drop-shadow-md">BET</span>
                                </button>

                                <div className="relative flex-1">
                                    <button 
                                        ref={buttonRef}
                                        onClick={() => setShowMenu(!showMenu)}
                                        className="w-full h-full py-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all border-[2px] shadow-lg bg-gray-800 border-yellow-500 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] hover:bg-gray-700 hover:border-yellow-400"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-tight text-white drop-shadow-md">ACTION</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isWaitNode && (
                <div 
                    className={`
                        w-[90%] -mt-2 pt-4 pb-3 px-3
                        bg-[#111] border-x-2 border-b-2 ${subNodeBorderColor}
                        rounded-b-xl shadow-xl
                        flex flex-col gap-2 relative z-0
                        transition-all
                    `}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="absolute top-0 left-0 right-0 h-4 bg-[#111] z-10" />

                    <div className="flex justify-between items-center relative z-20 px-1 border-b border-white/10 pb-1">
                         <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Next Step</span>
                         <span className={`font-mono font-bold text-sm ${activeBetAmount > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                             {activeBetAmount > 0 ? `$${activeBetAmount}` : subActionLabel}
                         </span>
                    </div>

                    <div className="flex gap-2 h-8 relative z-20">
                        <button 
                            onClick={handleBetClick}
                            className="flex-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-[9px] font-bold uppercase transition-colors"
                        >
                            Bet
                        </button>
                        <div className="flex-1 relative">
                             <button 
                                ref={subNodeButtonRef}
                                onClick={() => setShowMenu(!showMenu)}
                                className="w-full h-full rounded bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-[9px] font-bold uppercase transition-colors"
                            >
                                Action
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isResetLoop && (
                <div className="absolute top-[40px] -right-2 w-4 h-4 rounded-full bg-white border-4 border-[#1a1a1a] z-20 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            )}
        </div>
    );
};

const StrategyFlowBuilder: React.FC<StrategyFlowBuilderProps> = ({ 
    rootNode, 
    startBankroll,
    onUpdateNode, 
    onCreateNode, 
    onOpenTable, 
    onMoveNode, 
    canvasOffset,
    zoom
}) => {
    useEffect(() => {
        if (!document.getElementById('flash-style')) {
            const style = document.createElement('style');
            style.id = 'flash-style';
            style.innerHTML = `
                @keyframes fastFlash {
                    0% { border-color: #ef4444; opacity: 1; }
                    50% { border-color: #fbbf24; opacity: 0.6; }
                    100% { border-color: #ef4444; opacity: 1; }
                }
                .animate-fast-flash {
                    animation: fastFlash 0.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes menuRollOut {
                    from { opacity: 0; transform: scaleX(0); }
                    to { opacity: 1; transform: scaleX(1); }
                }
                .animate-menu-roll-out {
                    animation: menuRollOut 0.2s cubic-bezier(0.2, 0, 0.2, 1) forwards;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    const [nodeList, setNodeList] = useState<RenderNode[]>([]);
    const [connList, setConnList] = useState<RenderConnection[]>([]);
    
    // Physics Shake State
    const shakeIntensity = useRef(0);
    // Use tick to force update (safer for argument compatibility)
    const [, setTick] = useState(0);
    // Modified: Accept optional argument to satisfy any implicit 1-arg expectation
    const forceUpdate = (_?: any) => setTick(t => t + 1);

    useEffect(() => {
        const nodes: RenderNode[] = [];
        const conns: RenderConnection[] = [];
        
        const traverse = (
            node: StrategyNode, 
            parentId: string | null, 
            branchType: 'root'|'win'|'loss', 
            depth: number,
            incomingBankroll: number,
            incomingBets: PlacedBet[],
            incomingMultiplier: number
        ) => {
            const x = node.x || 0;
            const y = node.y || 0;

            let currentBets = [...incomingBets];
            let currentMultiplier = incomingMultiplier;

            if (node.bets && node.bets.length > 0) {
                 currentBets = [...node.bets];
                 currentMultiplier = 1;
            } else if (node.type === 'start_immediately' && node.bets) {
                currentBets = [...node.bets];
                currentMultiplier = 1;
            } else {
                switch (node.type) {
                    case 'double': currentMultiplier *= 2; break;
                    case 'triple': currentMultiplier *= 3; break;
                    case 'add_unit': currentMultiplier += 1; break;
                    case 'subtract_unit': currentMultiplier = Math.max(1, currentMultiplier - 1); break;
                    case 'martingale':
                        currentMultiplier = 1; 
                        break;
                    case 'reset': 
                         if (rootNode.bets) currentBets = [...rootNode.bets];
                         currentMultiplier = 1;
                        break;
                    case 'wait_spins':
                    case 'wait_condition':
                        if (node.postWaitAction) {
                            switch (node.postWaitAction) {
                                case 'double': currentMultiplier *= 2; break;
                                case 'triple': currentMultiplier *= 3; break;
                                case 'add_unit': currentMultiplier += 1; break;
                                case 'subtract_unit': currentMultiplier = Math.max(1, currentMultiplier - 1); break;
                                case 'reset': 
                                    if (rootNode.bets) currentBets = [...rootNode.bets];
                                    currentMultiplier = 1;
                                    break;
                            }
                        }
                        break;
                }
            }

            const { winDelta, lossDelta, totalWager } = calculateEstimatedOutcomes(currentBets, currentMultiplier);
            const isTerminal = node.type === 'reset';

            nodes.push({
                data: node,
                parentId,
                branchType,
                x,
                y,
                isVirtual: false,
                simulatedBankroll: Math.round(incomingBankroll),
                activeBetAmount: Math.round(totalWager),
                isTerminal
            });

            let showChildren = !isTerminal;

            if (node.type === 'start_immediately' || node.type === 'custom_bet') {
                 showChildren = showChildren && (!!node.bets && node.bets.length > 0);
            }
            
            if (showChildren) {
                const bankrollOnWin = incomingBankroll + winDelta;
                const bankrollOnLoss = incomingBankroll + lossDelta;
                const ySpread = Math.max(250, 600 - (depth * 100));
                
                if (node.children.win) {
                    let childTerm = node.children.win.type === 'reset';
                    if (node.children.win.id === rootNode.id) childTerm = true;
                    if (node.type === 'martingale' && node.martingaleLimitType === 'until_bankrupt') childTerm = true;
                
                    conns.push({ 
                        id: `c-w-${node.id}`,
                        sourceId: node.id,
                        targetId: node.children.win.id, 
                        startX: x, 
                        startY: y, 
                        endX: node.children.win.x || 0, 
                        endY: node.children.win.y || 0, 
                        type: 'win', 
                        isVirtual: false, 
                        isTerminal: childTerm 
                    });
                    
                    if (node.children.win.id !== rootNode.id) {
                        traverse(node.children.win, node.id, 'win', depth + 1, bankrollOnWin, currentBets, currentMultiplier);
                    }
                } else {
                    const vx = x + 400; 
                    const vy = y - ySpread;
                    const vWinId = `v-win-${node.id}`;
                    conns.push({ id: `c-w-v-${node.id}`, sourceId: node.id, targetId: vWinId, startX: x, startY: y, endX: vx, endY: vy, type: 'win', isVirtual: true, isTerminal: false });
                    
                    let vBets = rootNode.bets || [];
                    const vOutcome = calculateEstimatedOutcomes(vBets, 1);
                    nodes.push({
                        data: { id: vWinId, type: 'reset', label: 'Reset to Start', children: {win:null, loss:null}, x: vx, y: vy } as StrategyNode,
                        parentId: node.id,
                        branchType: 'win',
                        x: vx,
                        y: vy,
                        isVirtual: true,
                        simulatedBankroll: Math.round(bankrollOnWin),
                        activeBetAmount: Math.round(vOutcome.totalWager),
                        isTerminal: false 
                    });
                }

                const isMartingaleBankrupt = node.type === 'martingale' && node.martingaleLimitType === 'until_bankrupt';

                if (!isMartingaleBankrupt) {
                    if (node.children.loss) {
                        let childTerm = node.children.loss.type === 'reset';
                        if (node.children.loss.id === rootNode.id) childTerm = true;

                        conns.push({ id: `c-l-${node.id}`, sourceId: node.id, targetId: node.children.loss.id, startX: x, startY: y, endX: node.children.loss.x || 0, endY: node.children.loss.y || 0, type: 'loss', isVirtual: false, isTerminal: childTerm });
                        
                        if (node.children.loss.id !== rootNode.id) {
                            traverse(node.children.loss, node.id, 'loss', depth + 1, bankrollOnLoss, currentBets, currentMultiplier);
                        }
                    } else {
                        const vx = x + 400; 
                        const vy = y + ySpread;
                        const vLossId = `v-loss-${node.id}`;
                        conns.push({ id: `c-l-v-${node.id}`, sourceId: node.id, targetId: vLossId, startX: x, startY: y, endX: vx, endY: vy, type: 'loss', isVirtual: true, isTerminal: false });
                        
                        let vBets = rootNode.bets || [];
                        const vOutcome = calculateEstimatedOutcomes(vBets, 1);
                        nodes.push({
                            data: { id: vLossId, type: 'reset', label: 'Reset to Start', children: {win:null, loss:null}, x: vx, y: vy } as StrategyNode,
                            parentId: node.id,
                            branchType: 'loss',
                            x: vx,
                            y: vy,
                            isVirtual: true,
                            simulatedBankroll: Math.round(bankrollOnLoss),
                            activeBetAmount: Math.round(vOutcome.totalWager),
                            isTerminal: false
                        });
                    }
                }
            }
        };

        traverse(rootNode, null, 'root', 0, startBankroll, [], 1);
        setNodeList(nodes);
        setConnList(conns);

    }, [rootNode, startBankroll]);

    const checkStrategyComplete = (): boolean => {
        const visited = new Set<string>();
        
        const isBranchComplete = (node: StrategyNode): boolean => {
            if (visited.has(node.id)) return true;
            visited.add(node.id);

            if (node.type === 'reset') return true;
            if (!isNodeValid(node)) return false;

            let winComplete = false;
            if (node.children.win) {
                if (node.children.win.id === rootNode.id) winComplete = true; 
                else winComplete = isBranchComplete(node.children.win);
            }

            let lossComplete = false;
            if (node.type === 'martingale' && node.martingaleLimitType === 'until_bankrupt') {
                lossComplete = true;
            } else {
                if (node.children.loss) {
                    if (node.children.loss.id === rootNode.id) lossComplete = true;
                    else lossComplete = isBranchComplete(node.children.loss);
                }
            }
            
            return winComplete && lossComplete;
        };

        return isBranchComplete(rootNode);
    };

    const isStrategyComplete = checkStrategyComplete();

    const isDragging = useRef(false);
    const dragNodeId = useRef<string | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragNodeStart = useRef({ x: 0, y: 0 });

    const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        isDragging.current = true;
        dragNodeId.current = nodeId;
        dragStartPos.current = { x: e.clientX, y: e.clientY };

        const n = nodeList.find(n => n.data.id === nodeId);
        if (n) {
            dragNodeStart.current = { x: n.x, y: n.y };
        }
        
        document.addEventListener('mousemove', handleNodeMouseMove);
        document.addEventListener('mouseup', handleNodeMouseUp);
    };

    const handleNodeMouseMove = (e: MouseEvent) => {
        if (!isDragging.current || !dragNodeId.current) return;
        const dx = (e.clientX - dragStartPos.current.x) / zoom;
        const dy = (e.clientY - dragStartPos.current.y) / zoom;
        
        const velocity = Math.sqrt(e.movementX ** 2 + e.movementY ** 2);
        shakeIntensity.current = Math.min(velocity * 1.5, 25); 

        const isVirtualDrag = dragNodeId.current.startsWith('v-');
        
        if (isVirtualDrag) {
            const parts = dragNodeId.current.split('-');
            const type = parts[1] as 'win'|'loss';
            const parentId = parts.slice(2).join('-');
            const newX = dragNodeStart.current.x + dx;
            const newY = dragNodeStart.current.y + dy;
            onCreateNode(parentId, type, { x: newX, y: newY }, false);
            isDragging.current = false;
            document.removeEventListener('mousemove', handleNodeMouseMove);
            document.removeEventListener('mouseup', handleNodeMouseUp);
            return;
        }
        onMoveNode(dragNodeId.current, dragNodeStart.current.x + dx, dragNodeStart.current.y + dy);
    };

    const handleNodeMouseUp = () => {
        isDragging.current = false;
        dragNodeId.current = null;
        shakeIntensity.current = 0;
        forceUpdate(0);
        document.removeEventListener('mousemove', handleNodeMouseMove);
        document.removeEventListener('mouseup', handleNodeMouseUp);
    };

    return (
        <div 
            className="w-full h-full relative pointer-events-none" 
            style={{ 
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
                transformOrigin: '0 0'
            }}
        >
            <svg className="absolute top-[-5000px] left-[-5000px] w-[10000px] h-[10000px] pointer-events-none z-0 overflow-visible">
                <defs>
                    <filter id="glow-green"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    <filter id="glow-red"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                {connList.map(conn => {
                    const sx = conn.startX + 120 + 5000;
                    const sy = conn.startY + 40 + 5000;
                    const ex = conn.endX - 120 + 5000;
                    const ey = conn.endY + 40 + 5000;
                    const midX = (sx + ex) / 2;
                    
                    const isActiveShake = isDragging.current && (conn.sourceId === dragNodeId.current || conn.targetId === dragNodeId.current);
                    
                    let cp1x = midX;
                    let cp1y = sy;
                    let cp2x = midX;
                    let cp2y = ey;

                    if (isActiveShake) {
                        const jitter = shakeIntensity.current;
                        cp1x += (Math.random() - 0.5) * jitter;
                        cp1y += (Math.random() - 0.5) * jitter;
                        cp2x += (Math.random() - 0.5) * jitter;
                        cp2y += (Math.random() - 0.5) * jitter;
                    }

                    const pathD = `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ex} ${ey}`;
                    
                    const color = conn.type === 'win' ? '#4ade80' : '#f87171';
                    const glow = conn.type === 'win' ? 'url(#glow-green)' : 'url(#glow-red)';
                    
                    const effectiveIsTerminal = isStrategyComplete ? true : conn.isTerminal;
                    const effectiveIsComplete = isStrategyComplete ? true : conn.isComplete;
                    
                    const opacity = effectiveIsTerminal ? 0.3 : 0.8;
                    const stopAnim = isStrategyComplete;

                    return (
                        <g key={`${conn.id}-${effectiveIsTerminal ? 'term' : 'active'}`}>
                            <path id={`path-${conn.id}`} d={pathD} fill="none" stroke={color} strokeWidth="4" filter={glow} opacity={opacity} />
                            {(!stopAnim && !effectiveIsTerminal && !effectiveIsComplete) && (
                                <>
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <text
                                            key={i}
                                            dy={5}
                                            fill="#ffffff"
                                            fontSize="10"
                                            fontWeight="900"
                                            fontFamily="monospace"
                                            style={{ textShadow: '0 0 3px rgba(255,255,255,0.9)' }}
                                        >
                                            {i % 2 === 0 ? '1' : '0'}
                                            <animateMotion
                                                dur="1.5s"
                                                repeatCount="indefinite"
                                                begin={`-${i * 0.25}s`}
                                                calcMode="linear"
                                            >
                                                <mpath href={`#path-${conn.id}`} />
                                            </animateMotion>
                                        </text>
                                    ))}
                                </>
                            )}
                        </g>
                    );
                })}
            </svg>
            {nodeList.map(rn => (
                <NodeCard 
                    key={`${rn.data.id}-${rn.data.type}-${rn.data.label}`}
                    node={rn.data}
                    renderData={rn}
                    startBankroll={startBankroll}
                    onUpdateNode={onUpdateNode}
                    onCreateNode={onCreateNode}
                    onOpenTable={onOpenTable}
                    onStartDrag={handleNodeDragStart}
                />
            ))}
        </div>
    );
};

export default StrategyFlowBuilder;
