
import { GoogleGenAI } from "@google/genai";
import { SimulationStats, PlacedBet, StrategyConfig, SimulationStep } from "../types";

export const analyzeSimulation = async (
  stats: SimulationStats,
  steps: SimulationStep[],
  bets: PlacedBet[],
  strategy: StrategyConfig
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Cannot perform AI analysis.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const betSummary = bets.map(b => `${b.type} on ${b.label || b.numbers.join(',')}`).join(', ');
  
  const root = strategy.rootNode;
  const winAction = root.children.win ? root.children.win.label : "Reset to Start";
  const lossAction = root.children.loss ? root.children.loss.label : "Reset to Start";

  // Summarize steps to avoid token overload if massive, though Flash handles it well.
  // We'll format a readable log.
  const spinLog = steps.map(s => 
    `Spin ${s.spinIndex}: [${s.result.number} ${s.result.color}] | Bet: $${s.betTotal} | Payout: $${s.payout} | Bank: $${s.bankroll} | ${s.actionType || ''}`
  ).join('\n');

  const prompt = `
    You are a professional casino analyst. Analyze this American Roulette simulation run.
    
    STRATEGY CONFIGURATION:
    - Base Bets: ${betSummary}
    - Root Strategy Node: ${root.label}
    - Immediate Action on Win: ${winAction}
    - Immediate Action on Loss: ${lossAction}
    
    SIMULATION STATS (Summary):
    - Total Spins Played: ${stats.totalSpins}
    - Starting Bankroll: $${stats.initialBankroll}
    - Final Bankroll: $${stats.finalBankroll}
    - ROI: ${stats.roi.toFixed(2)}%
    - Wins/Losses: ${stats.wins}/${stats.losses}
    - Max Drawdown: $${stats.maxDrawdown}
    - Longest Loss Streak: ${stats.longestLossStreak}
    
    FULL SPIN LOG:
    ${spinLog}

    INSTRUCTIONS:
    Provide a concise, insightful critique of this betting strategy based on the spin log and stats.
    - Identify specific turning points (e.g., "Around spin 45, the Martingale bet reached $X...").
    - Did the strategy survive the variance? 
    - Was the risk management (stop loss/take profit) effective? 
    - Point out any dangerous betting ramps or patterns in the log.
    
    Keep the response under 250 words. Be specific about the data provided.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate analysis due to an error.";
  }
};
