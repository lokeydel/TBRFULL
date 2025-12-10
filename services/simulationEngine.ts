
import { BetType, PlacedBet, SimulationStep, SimulationStats, SpinResult, StrategyConfig, SimConfig, StrategyNode, BetOutcome } from "../types";
import { NUMBER_COLORS } from "../constants";

/**
 * AMERICAN ROULETTE LOGIC ENGINE
 * 
 * Rules Implemented:
 * 1. Wheel: 0-36 plus 00 (38 pockets).
 * 2. 0 and 00 are "Green".
 * 3. Outside Bets (Even/Odd, Red/Black, High/Low, Dozen, Column) LOSE on 0 and 00.
 * 4. Basket/Five-Number Bet (0, 00, 1, 2, 3) pays 6:1.
 * 5. General Payouts: Straight 35:1, Split 17:1, Street 11:1, Corner 8:1, Line 5:1.
 */

// Helper: Normalize 00 to 37 for internal numeric comparison
const getResultValue = (resultNum: number | '00'): number => {
  return resultNum === '00' ? 37 : resultNum;
};

// Check if a specific bet wins based on the spin result
const isWin = (resultNum: number | '00', bet: PlacedBet): boolean => {
  const resultVal = getResultValue(resultNum);
  const isZeroOrDoubleZero = (resultVal === 0 || resultVal === 37);

  // --- FIVE-NUMBER BET (American Special: Basket) ---
  // Covers 0, 00, 1, 2, 3. Pays 6:1.
  if (bet.type === BetType.BASKET) {
    // 0, 00(37), 1, 2, 3
    return [0, 37, 1, 2, 3].includes(resultVal);
  }

  // --- EVEN MONEY BETS (1:1) ---
  // STRICT RULE: Lose if 0 or 00 appear.
  if (bet.type === BetType.RED_BLACK) {
      if (isZeroOrDoubleZero) return false;
      return NUMBER_COLORS[resultNum.toString()] === bet.label?.toLowerCase();
  } 
  
  if (bet.type === BetType.EVEN_ODD) {
      if (isZeroOrDoubleZero) return false;
      const isEven = (resultVal % 2 === 0);
      if (bet.label === 'Even') return isEven;
      if (bet.label === 'Odd') return !isEven;
      return false;
  }

  if (bet.type === BetType.HIGH_LOW) {
      if (isZeroOrDoubleZero) return false;
      if (bet.label === '1-18') return resultVal >= 1 && resultVal <= 18;
      if (bet.label === '19-36') return resultVal >= 19 && resultVal <= 36;
      return false;
  }
  
  // --- COLUMN & DOZEN BETS (2:1) ---
  // STRICT RULE: Lose if 0 or 00 appear.
  if (bet.type === BetType.DOZEN) {
       if (isZeroOrDoubleZero) return false;
       if (bet.label === '1st 12') return resultVal >= 1 && resultVal <= 12;
       if (bet.label === '2nd 12') return resultVal >= 13 && resultVal <= 24;
       if (bet.label === '3rd 12') return resultVal >= 25 && resultVal <= 36;
       return false;
  }

  if (bet.type === BetType.COLUMN) {
       if (isZeroOrDoubleZero) return false;
       
       // Use specific numbers if provided (preferred)
       if (bet.numbers.length > 0) return bet.numbers.includes(resultVal);

       // Fallback to Modulo Logic if numbers aren't pre-populated
       // Bot Row: 1, 4, 7... (Remainder 1)
       if (bet.label === '2 to 1 (Bot)') return resultVal % 3 === 1;
       // Mid Row: 2, 5, 8... (Remainder 2)
       if (bet.label === '2 to 1 (Mid)') return resultVal % 3 === 2;
       // Top Row: 3, 6, 9... (Remainder 0)
       if (bet.label === '2 to 1 (Top)') return resultVal !== 0 && resultVal !== 37 && resultVal % 3 === 0;
       
       return false;
  }

  // --- INSIDE BETS ---
  // Straight (35:1), Split (17:1), Street (11:1), Corner (8:1), Line (5:1)
  // Rule: Win only if number is explicitly in the bet.
  // 0 and 00 are treated as standard numbers here (must be covered to win).
  return bet.numbers.includes(resultVal);
};

// Calculate detailed payout for a set of bets
const calculateDetailedOutcomes = (bets: PlacedBet[], result: SpinResult): { totalPayout: number, outcomes: BetOutcome[] } => {
  let totalPayout = 0;
  const outcomes: BetOutcome[] = [];
  
  bets.forEach(bet => {
    const win = isWin(result.number, bet);
    let payout = 0;
    
    if (win) {
        let multiplier = 0;
        
        // Exact American Roulette Payout Ratios
        switch(bet.type) {
            case BetType.STRAIGHT: multiplier = 35; break;
            case BetType.SPLIT: multiplier = 17; break;
            case BetType.STREET: multiplier = 11; break;
            case BetType.CORNER: multiplier = 8; break;
            case BetType.BASKET: multiplier = 6; break; // 0-00-1-2-3 (Specific to American)
            case BetType.LINE: multiplier = 5; break;   // Six line / Double Street
            case BetType.COLUMN: multiplier = 2; break;
            case BetType.DOZEN: multiplier = 2; break;
            case BetType.RED_BLACK:
            case BetType.EVEN_ODD:
            case BetType.HIGH_LOW:
                multiplier = 1; break;
            default: multiplier = 1; break;
        }
        
        // Casino Payout Logic: 
        // Return = Stake (Original) + Winnings (Stake * Ratio)
        payout = bet.amount + (bet.amount * multiplier);
    }

    totalPayout += payout;
    outcomes.push({
        bet,
        won: win,
        payout,
        net: payout - bet.amount
    });
  });

  return { totalPayout, outcomes };
};

// Generate a random spin on an American Wheel (0-36 + 00)
const generateSpin = (): SpinResult => {
    // 38 possible outcomes: 0-36 (37 numbers) + 00 (1 number)
    const rawSpin = Math.floor(Math.random() * 38);
    let spinNum: number | '00' = rawSpin === 37 ? '00' : rawSpin;
    const color = NUMBER_COLORS[spinNum.toString()] || 'green';
    return { number: spinNum, color };
};

// --- CORE SIMULATION RUNNER ---
export const runSimulation = (
  initialBankroll: number,
  strategy: StrategyConfig,
  config: SimConfig
): { steps: SimulationStep[], stats: SimulationStats } => {
  let bankroll = initialBankroll;
  const steps: SimulationStep[] = [];
  
  const rootNode = strategy.rootNode;
  let currentNode: StrategyNode = rootNode;
  
  let currentBaseBets: PlacedBet[] = rootNode.bets || [];
  let currentMultiplier = 1;

  let spinsConsumed = 0;

  // Stats Counters
  let wins = 0;
  let losses = 0;
  let maxDrawdown = 0;
  let maxUpside = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  // Helper to record a step atomically
  const recordStep = (
    result: SpinResult, 
    activeBets: PlacedBet[], 
    actionType: string,
    isWaitStep: boolean = false
  ) => {
    spinsConsumed++;
    
    // 1. Snapshot Bets (Deep Copy to prevent reference mutation)
    const betsSnapshot = activeBets.map(b => ({...b}));
    
    // 2. Calculate Financials
    const betTotal = betsSnapshot.reduce((sum, b) => sum + b.amount, 0);
    
    // Check bankruptcy before processing (unless it's a wait step)
    if (!isWaitStep && betTotal > bankroll) {
        return false; // Cannot afford bet
    }

    // NEW: Get detailed outcomes instead of just total
    const { totalPayout, outcomes } = isWaitStep 
        ? { totalPayout: 0, outcomes: [] } 
        : calculateDetailedOutcomes(betsSnapshot, result);

    const net = totalPayout - betTotal;

    // 3. Update Bankroll ATOMICALLY
    // Bankroll = Previous + (Payout - Cost)
    bankroll = bankroll + net;

    // 4. Update Stats
    if (!isWaitStep) {
        const isWin = net > 0;
        if (isWin) {
            wins++;
            currentWinStreak++;
            currentLossStreak = 0;
        } else if (net < 0) {
            losses++;
            currentLossStreak++;
            currentWinStreak = 0;
        } else {
            // Push (Net 0) - breaks streaks? Usually yes in casino stats
            currentLossStreak = 0;
            currentWinStreak = 0;
        }

        if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
        if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;

        const totalNetChange = bankroll - initialBankroll;
        if (totalNetChange < maxDrawdown) maxDrawdown = totalNetChange;
        if (totalNetChange > maxUpside) maxUpside = totalNetChange;
    }

    // 5. Push Log Entry with FULL DETAILS
    steps.push({
        spinIndex: spinsConsumed,
        result,
        bets: betsSnapshot,
        outcomes, // Frozen detailed results
        betTotal,
        payout: totalPayout,
        net,
        bankroll,
        won: net > 0, // Strictly based on profit
        actionType
    });

    return true; // Success
  };

  // --- PRE-SIM WAIT PHASES ---
  if (rootNode.type === 'wait_spins' && rootNode.value) {
      for (let w = 0; w < rootNode.value; w++) {
          const res = generateSpin();
          recordStep(res, [], 'WAITING', true);
      }
  } else if (rootNode.type === 'wait_condition' && rootNode.condition) {
      let conditionMet = false;
      let safety = 0;
      while (!conditionMet && safety < 200) {
          const res = generateSpin();
          recordStep(res, [], `WAITING_FOR_${rootNode.condition.toUpperCase()}`, true);
          if (rootNode.condition === 'red' && res.color === 'red') conditionMet = true;
          if (rootNode.condition === 'black' && res.color === 'black') conditionMet = true;
          safety++;
      }
  }

  // --- MAIN SIMULATION LOOP ---
  while (spinsConsumed < config.maxSpins) {
    if (bankroll <= strategy.stopLoss) break;
    if (strategy.takeProfit > 0 && bankroll >= strategy.takeProfit) break;
    if (bankroll <= 0) break;

    // --- LOGIC BLOCK: DETERMINE ACTIVE BETS ---
    let activeBets: PlacedBet[] = [];

    // --- MARTINGALE LOGIC ---
    if (currentNode.type === 'martingale') {
        const limitType = currentNode.martingaleLimitType || 'until_bankrupt';
        const limitValue = currentNode.martingaleLimitValue || 0;
        
        let martingaleStepCount = 0;
        let martingaleActive = true;
        const sequenceStartBankroll = bankroll;

        while (martingaleActive && spinsConsumed < config.maxSpins && bankroll > 0) {
            activeBets = currentBaseBets.map(b => ({
                ...b,
                amount: Math.floor(b.amount * currentMultiplier)
            }));
            
            // Check Table Max
            const totalWager = activeBets.reduce((sum, b) => sum + b.amount, 0);
            if (totalWager > config.tableMax || totalWager > bankroll) {
                martingaleActive = false;
                break;
            }

            // --- EXECUTE SPIN ---
            const result = generateSpin();
            const success = recordStep(result, activeBets, `MARTINGALE_x${currentMultiplier}`);
            if (!success) break; // Bankrupt

            // --- EVALUATE OUTCOME ---
            // Access the step we just pushed to get the result
            const lastStep = steps[steps.length - 1];
            const roundWin = lastStep.won;
            
            martingaleStepCount++;
            const currentMartingaleProfit = bankroll - sequenceStartBankroll;

            // Martingale Progression Logic
            if (limitType === 'until_bankrupt') {
                 if (roundWin) martingaleActive = false;
                 else currentMultiplier *= 2; 
            } 
            else if (limitType === 'profit_target') {
                if (currentMartingaleProfit >= limitValue) martingaleActive = false;
                else {
                     if (!roundWin) currentMultiplier *= 2;
                     else currentMultiplier = 1; // Reset multiplier on win but keep going until profit? Usually reset sequence.
                }
            } 
            else if (limitType === 'spin_count') {
                if (martingaleStepCount >= limitValue) martingaleActive = false;
                else {
                    if (!roundWin) currentMultiplier *= 2;
                }
            }
            
            if (currentMultiplier > 10000) break; // Safety
        }

        const sequenceWon = (bankroll >= sequenceStartBankroll);
        let nextNode: StrategyNode | null = sequenceWon ? currentNode.children.win : currentNode.children.loss;
        
        if (!nextNode) {
             nextNode = rootNode;
             currentBaseBets = rootNode.bets || [];
             currentMultiplier = 1;
             currentNode = rootNode;
        } else {
             currentNode = nextNode;
             if (currentNode.bets && currentNode.bets.length > 0) {
                 currentBaseBets = [...currentNode.bets];
                 currentMultiplier = 1;
             }
             
             // Apply Node Modifiers
             switch (currentNode.type) {
                case 'double': if(!currentNode.bets) currentMultiplier *= 2; break;
                case 'triple': if(!currentNode.bets) currentMultiplier *= 3; break;
                case 'add_unit': if(!currentNode.bets) currentMultiplier += 1; break;
                case 'subtract_unit': if(!currentNode.bets) currentMultiplier = Math.max(1, currentMultiplier - 1); break;
                case 'reset': 
                    currentMultiplier = 1; 
                    currentBaseBets = [...(rootNode.bets || [])];
                    currentNode = rootNode;
                    break;
             }
        }
        continue; 
    }

    // --- REPEAT UNTIL LOGIC ---
    if (currentNode.type === 'repeat_until') {
        const repeatType = currentNode.repeatUntilType || 'spins';
        const repeatValue = currentNode.repeatUntilValue || 1;
        
        let loopActive = true;
        let loopSpins = 0;
        let loopWins = 0;
        const seqStartBankroll = bankroll;

        while (loopActive && spinsConsumed < config.maxSpins && bankroll > 0) {
            activeBets = currentBaseBets.map(b => ({
                ...b,
                amount: Math.floor(b.amount * currentMultiplier)
            }));
            
            // Validate Max Bet / Bankroll
            let totalWager = activeBets.reduce((sum, b) => sum + b.amount, 0);
            if (totalWager > config.tableMax) {
                const scaleFactor = config.tableMax / totalWager;
                activeBets = activeBets.map(b => ({...b, amount: Math.max(1, Math.floor(b.amount * scaleFactor))}));
                totalWager = activeBets.reduce((sum, b) => sum + b.amount, 0);
            }

            if (totalWager > bankroll) {
                loopActive = false;
                break;
            }

            // --- EXECUTE SPIN ---
            const result = generateSpin();
            recordStep(result, activeBets, `REPEAT_${repeatType.toUpperCase()}`);
            
            const lastStep = steps[steps.length - 1];
            loopSpins++;
            if (lastStep.won) loopWins++;

            // Check Exit Condition
            if (repeatType === 'spins' && loopSpins >= repeatValue) loopActive = false;
            if (repeatType === 'wins' && loopWins >= repeatValue) loopActive = false;
            if (repeatType === 'profit_target' && (bankroll - seqStartBankroll) >= repeatValue) loopActive = false;
            if (repeatType === 'loss_limit' && (seqStartBankroll - bankroll) >= repeatValue) loopActive = false;
        }

        let nextNode: StrategyNode | null = currentNode.children.win; // Default flow out
        
        if (!nextNode) {
             nextNode = rootNode;
             currentBaseBets = rootNode.bets || [];
             currentMultiplier = 1;
             currentNode = rootNode;
        } else {
             currentNode = nextNode;
             if (currentNode.bets && currentNode.bets.length > 0) {
                 currentBaseBets = [...currentNode.bets];
                 currentMultiplier = 1;
             }
             switch (currentNode.type) {
                case 'double': if(!currentNode.bets) currentMultiplier *= 2; break;
                case 'triple': if(!currentNode.bets) currentMultiplier *= 3; break;
                case 'add_unit': if(!currentNode.bets) currentMultiplier += 1; break;
                case 'subtract_unit': if(!currentNode.bets) currentMultiplier = Math.max(1, currentMultiplier - 1); break;
                case 'reset': 
                    currentMultiplier = 1; 
                    currentBaseBets = [...(rootNode.bets || [])];
                    currentNode = rootNode;
                    break;
             }
        }
        continue;
    }

    // --- STANDARD SINGLE SPIN LOGIC ---
    activeBets = currentBaseBets.map(b => ({
      ...b,
      amount: Math.floor(b.amount * currentMultiplier)
    }));

    let totalWager = activeBets.reduce((sum, b) => sum + b.amount, 0);
    
    // Scaling if over table max
    if (totalWager > config.tableMax) {
        const scaleFactor = config.tableMax / totalWager;
        activeBets = activeBets.map(b => ({
            ...b,
            amount: Math.max(1, Math.floor(b.amount * scaleFactor))
        }));
        totalWager = activeBets.reduce((sum, b) => sum + b.amount, 0);
    }

    if (totalWager > bankroll) break; // Game over

    // --- EXECUTE SPIN ---
    const result = generateSpin();
    recordStep(result, activeBets, activeBets.length > 0 ? (steps.length === 0 ? 'START' : 'BET') : 'NO_BET');

    const lastStep = steps[steps.length - 1];
    const roundWin = lastStep.won;

    // --- DETERMINE NEXT NODE ---
    let nextNode: StrategyNode | null = roundWin ? currentNode.children.win : currentNode.children.loss;
    
    if (!nextNode) {
        nextNode = rootNode;
        currentBaseBets = rootNode.bets || [];
        currentMultiplier = 1;
        currentNode = rootNode;
    } else {
        currentNode = nextNode;
        
        // If the new node has explicit bets, they override previous bets and reset multiplier
        if (currentNode.bets && currentNode.bets.length > 0) {
            currentBaseBets = [...currentNode.bets];
            currentMultiplier = 1;
        }

        switch (currentNode.type) {
            case 'double': if(!currentNode.bets) currentMultiplier *= 2; break;
            case 'triple': if(!currentNode.bets) currentMultiplier *= 3; break;
            case 'add_unit': if(!currentNode.bets) currentMultiplier += 1; break;
            case 'subtract_unit': if(!currentNode.bets) currentMultiplier = Math.max(1, currentMultiplier - 1); break;
            case 'reset': 
                currentMultiplier = 1; 
                currentBaseBets = [...(rootNode.bets || [])];
                currentNode = rootNode;
                break;
            case 'wait_spins':
                if (currentNode.value) {
                    for(let k=0; k<currentNode.value; k++) {
                        const res = generateSpin(); 
                        recordStep(res, [], 'WAITING', true);
                    }
                }
                // Post-Wait Action
                if (currentNode.postWaitAction && (!currentNode.bets || currentNode.bets.length === 0)) {
                    switch (currentNode.postWaitAction) {
                        case 'double': currentMultiplier *= 2; break;
                        case 'triple': currentMultiplier *= 3; break;
                        case 'add_unit': currentMultiplier += 1; break;
                        case 'subtract_unit': currentMultiplier = Math.max(1, currentMultiplier - 1); break;
                        case 'reset': 
                            currentMultiplier = 1; 
                            currentBaseBets = [...(rootNode.bets || [])];
                            break;
                    }
                }
                break;
        }
    }
  }

  const stats: SimulationStats = {
    initialBankroll,
    finalBankroll: bankroll,
    totalSpins: steps.length,
    wins,
    losses,
    maxDrawdown,
    maxUpside,
    longestWinStreak,
    longestLossStreak,
    roi: initialBankroll > 0 ? ((bankroll - initialBankroll) / initialBankroll) * 100 : 0,
    config
  };

  return { steps, stats };
};
