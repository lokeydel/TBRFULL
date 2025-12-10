
export enum ChipValue {
  ONE = 1,
  FIVE = 5,
  TEN = 10,
  TWENTY_FIVE = 25,
  FIFTY = 50,
  ONE_HUNDRED = 100
}

export enum BetType {
  STRAIGHT = 'STRAIGHT',
  SPLIT = 'SPLIT',
  STREET = 'STREET',
  CORNER = 'CORNER',
  BASKET = 'BASKET', // 0-00-1-2-3
  LINE = 'LINE', // Double Street
  COLUMN = 'COLUMN',
  DOZEN = 'DOZEN',
  RED_BLACK = 'RED_BLACK',
  EVEN_ODD = 'EVEN_ODD',
  HIGH_LOW = 'HIGH_LOW',
  TRIO = 'TRIO'
}

export interface PlacedBet {
  id: string;
  type: BetType;
  numbers: number[]; // Numbers covered
  amount: number;
  label?: string; // e.g., "Red", "1st 12"
}

export interface SpinResult {
  number: number | '00';
  color: 'red' | 'black' | 'green';
}

// NEW: Detailed outcome for a single bet in a spin
export interface BetOutcome {
  bet: PlacedBet;
  won: boolean;
  payout: number; // The gross return (stake + profit)
  net: number;    // The net profit/loss for this specific bet (payout - amount)
}

export interface SimulationStep {
  spinIndex: number;
  result: SpinResult;
  bets: PlacedBet[]; // SNAPSHOT of bets for this spin
  outcomes: BetOutcome[]; // NEW: Detailed results per bet
  betTotal: number;  // Sum of all bet amounts
  payout: number;    // Total return
  net: number;       // payout - betTotal
  bankroll: number;  // Bankroll AFTER this spin
  won: boolean;      // True if net > 0
  actionType?: string;
}

export interface SimulationStats {
  initialBankroll: number;
  finalBankroll: number;
  totalSpins: number;
  wins: number;
  losses: number;
  maxDrawdown: number;
  maxUpside: number;
  longestWinStreak: number;
  longestLossStreak: number;
  roi: number;
  config?: SimConfig;
}

export interface SimConfig {
  maxSpins: number;
  tableMin: number;
  tableMax: number;
}

// New Strategy Flow Types
export type ProgressionType = 
  | 'start_immediately' 
  | 'wait_spins' 
  | 'wait_condition' 
  | 'reset' 
  | 'double' 
  | 'triple' 
  | 'add_unit' 
  | 'subtract_unit' 
  | 'same_bet' 
  | 'custom_bet'
  | 'martingale'
  | 'repeat_until'; // NEW

export type MartingaleLimitType = 'profit_target' | 'spin_count' | 'until_bankrupt';
export type RepeatUntilType = 'spins' | 'wins' | 'profit_target' | 'loss_limit'; // NEW

export type SimSpeed = 'slow' | 'medium' | 'fast';

// Recursive Node Structure
export interface StrategyNode {
  id: string;
  type: ProgressionType;
  label: string;
  bets?: PlacedBet[]; // For custom_bet or base bet
  value?: number; // For wait_spins (e.g., 5) or Martingale Value
  condition?: string; // For wait_condition (e.g., 'red')
  
  // Compound Logic: Action to take AFTER the primary behavior (specifically for Waits)
  postWaitAction?: ProgressionType; 

  // Martingale Specifics
  martingaleLimitType?: MartingaleLimitType;
  martingaleLimitValue?: number;

  // Repeat Until Specifics
  repeatUntilType?: RepeatUntilType;
  repeatUntilValue?: number;

  // Visual Position
  x?: number;
  y?: number;
  
  // Custom Display Title (Editable Header)
  title?: string;

  // Recursive Children
  children: {
    win: StrategyNode | null;
    loss: StrategyNode | null;
  };
}

export interface StrategyConfig {
  rootNode: StrategyNode;
  stopLoss: number;
  takeProfit: number;
}

export interface SavedStrategy {
  name: string;
  timestamp: number;
  config: {
    startBankroll: number;
    tableMin: number;
    tableMax: number;
    maxSpins: number;
    stopLoss: number;
    takeProfit: number;
  };
  rootNode: StrategyNode;
}
