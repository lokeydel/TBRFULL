

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PlacedBet, SimulationStats, SimulationStep, StrategyConfig, SimConfig, StrategyNode, ProgressionType, SavedStrategy, SimSpeed } from './types';
import TableModal from './components/TableModal';
import StrategyFlowBuilder, { isNodeValid } from './components/StrategyFlowBuilder';
import SimulationChart from './components/SimulationChart'; // NEW IMPORT
import { runSimulation } from './services/simulationEngine';
import { analyzeSimulation } from './services/geminiService';
// Removed explicit Recharts imports here as they are now in the sub-component
import { ROULETTE_NUMBERS, NUMBER_COLORS } from './constants';

// --- CONFIGURATION ---
// Updated to a reliable MP3 file from Internet Archive (Star Trek Engine Noise) for broad compatibility
const BACKGROUND_MUSIC_URL = "https://archive.org/download/StarTrekTNGAmbientEngineNoise/StarTrekTNGAmbientEngineNoise.mp3"; 

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- AUDIO COMPONENT ---
const BackgroundAudio = ({ url }: { url: string }) => {
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = 0.5;
    }
  }, []);

  // Unlocker for Autoplay policies
  useEffect(() => {
      const unlock = () => {
          if (audioRef.current && audioRef.current.paused && !muted) {
              audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(e => console.warn("Audio autoplay blocked, waiting for interaction", e instanceof Error ? e.message : "Unknown error"));
          }
      };
      
      if (!isPlaying) {
          window.addEventListener('click', unlock, { once: true });
          window.addEventListener('touchstart', unlock, { once: true });
          window.addEventListener('keydown', unlock, { once: true });
      }
      return () => {
          window.removeEventListener('click', unlock);
          window.removeEventListener('touchstart', unlock);
          window.removeEventListener('keydown', unlock);
      };
  }, [isPlaying, muted]);

  return (
    <div className="relative">
        <audio 
            ref={audioRef}
            src={url}
            loop
            autoPlay
            muted={muted}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => console.warn("Audio source error:", e.currentTarget.error?.message || "Unknown error")}
        />
        <button 
            onClick={() => setMuted(!muted)}
            className={`
                p-2 rounded-full border transition-all duration-300 relative group
                ${muted 
                    ? 'bg-red-900/50 border-red-700 text-red-400 hover:bg-red-900' 
                    : 'bg-green-900/50 border-green-700 text-green-400 hover:bg-green-900 hover:shadow-[0_0_10px_#4ade80]'}
            `}
            title={muted ? "Unmute Ambient Audio" : "Mute Ambient Audio"}
        >
            {/* Playback Status Indicator (Small dot) */}
            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-black/50 ${isPlaying ? 'bg-green-400 shadow-[0_0_5px_#4ade80]' : 'bg-red-500'}`} />

            {muted ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
            ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
            )}
        </button>
    </div>
  );
};

const RecentSpinsDisplay = ({ steps }: { steps: SimulationStep[] }) => {
    // Take last 12, keep chronological order (Oldest -> Newest)
    const recent = steps.slice(-12);
  
    return (
      <div className="w-full h-24 bg-gray-900/90 border-b border-gray-700 flex items-center justify-center gap-3 overflow-hidden shrink-0 relative z-20 backdrop-blur-sm animate-fadeIn">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-start opacity-50">
             <span className="text-[10px] font-bold uppercase text-white tracking-widest">Live Feed</span>
             <div className="w-full h-0.5 bg-gradient-to-r from-green-500 to-transparent" />
          </div>
          
          {recent.map((step, i) => {
               // Newest is on the RIGHT (last index)
               const isNewest = i === recent.length - 1;
               const colorClass = step.result.color === 'red' ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 
                                  step.result.color === 'black' ? 'bg-gray-800 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 
                                  'bg-green-600 shadow-[0_0_15px_rgba(22,163,74,0.4)]';
               
               return (
                   <div 
                      key={step.spinIndex}
                      className={`
                          flex flex-col items-center justify-center font-black text-white shadow-lg transition-all duration-300
                          ${isNewest ? 'w-16 h-16 rounded-xl border-2 border-white scale-125 z-10 mx-2' : 'w-10 h-10 rounded-lg border border-transparent opacity-60 scale-90'}
                          ${colorClass}
                      `}
                   >
                       <span className={isNewest ? "text-2xl leading-none" : "text-sm leading-none"}>{step.result.number}</span>
                       {isNewest && <span className="text-[8px] uppercase tracking-wider font-bold opacity-80 mt-1">{step.result.color}</span>}
                   </div>
               )
          })}
          {recent.length === 0 && <span className="text-gray-500 text-xs animate-pulse font-mono">WAITING FOR NEXT SPIN...</span>}
      </div>
    );
  };

const VolumetricRays = () => (
    <div 
        className="absolute top-[-30%] left-[-20%] w-[100%] h-[150%] pointer-events-none z-[5] overflow-hidden mix-blend-screen opacity-100"
        style={{
            maskImage: 'linear-gradient(110deg, black 0%, black 35%, transparent 75%)',
            WebkitMaskImage: 'linear-gradient(110deg, black 0%, black 35%, transparent 75%)'
        }}
    >
        {/* Main Purple Beam - Intensified */}
        <div className="absolute top-0 left-0 w-[150%] h-[30%] bg-gradient-to-r from-violet-600/80 via-purple-500/40 to-transparent blur-[80px] transform -rotate-45 origin-top-left animate-ray-pulse" style={{ animationDelay: '0s' }} />
        
        {/* Secondary Fuchsia Beam - Intensified */}
        <div className="absolute top-[15%] left-0 w-[150%] h-[20%] bg-gradient-to-r from-fuchsia-500/60 via-purple-400/30 to-transparent blur-[60px] transform -rotate-[40deg] origin-top-left animate-ray-pulse" style={{ animationDelay: '1.5s' }} />
        
        {/* White/Cyan Highlight Beam (Contrast) */}
        <div className="absolute top-[25%] left-0 w-[150%] h-[15%] bg-gradient-to-r from-cyan-200/30 via-white/20 to-transparent blur-[50px] transform -rotate-[35deg] origin-top-left animate-ray-pulse" style={{ animationDelay: '3s' }} />
        
        {/* Deep Violet Beam */}
        <div className="absolute top-[35%] left-0 w-[150%] h-[25%] bg-gradient-to-r from-violet-800/60 via-indigo-600/40 to-transparent blur-[70px] transform -rotate-[30deg] origin-top-left animate-ray-pulse" style={{ animationDelay: '0.5s' }} />
        
        {/* Caustic Noise Overlay for Rays */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat mix-blend-overlay" />
    </div>
);

const BackgroundEffects = ({ glowTrigger, sceneMode }: { glowTrigger: number, sceneMode: 'space' | 'brain' }) => {
  // Static Stars (Only for Space Mode)
  const stars = useMemo(() => Array.from({ length: 400 }).map((_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() < 0.7 ? '1px' : (Math.random() < 0.9 ? '2px' : '3px'),
    opacity: Math.random() * 0.5 + 0.3,
    delay: `${Math.random() * 4}s`
  })), []);

  // BRAIN MODE: Generate Neural Network
  const { neurons, synapses } = useMemo(() => {
    // Generate Neurons
    const nodeCount = 50; // Increased density for close-up feel
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 3 + Math.random() * 5, // Varied sizes for organic feel
            pulseRate: 2 + Math.random() * 4 // Random pulse duration
        });
    }

    // Generate Synapses (Connections between close neurons)
    const connections = [];
    for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            // Calculate distance in approximate % units
            const dist = Math.sqrt(dx * dx + dy * dy); 
            // Connect if reasonably close (creates clusters)
            if (dist < 18) { 
                 connections.push({
                     id: `${i}-${j}`,
                     start: nodes[i],
                     end: nodes[j]
                 });
            }
        }
    }
    return { neurons: nodes, synapses: connections };
  }, []);

  // Shooting Star State
  const [shootingStar, setShootingStar] = useState<{ id: number, top: string, left: string, angle: number, duration: string } | null>(null);
  
  // Classic UFO State
  const [ufoActive, setUfoActive] = useState(false);
  const [ufoConfig, setUfoConfig] = useState<{ startY: number, endY: number, type: 'flyby' | 'return' } | null>(null);

  // Glow State for Planet
  const [isGlowing, setIsGlowing] = useState(false);
  const [shockwaves, setShockwaves] = useState<number[]>([]);

  useEffect(() => {
      if (glowTrigger > 0) {
          setIsGlowing(true);
          const id = Date.now();
          setShockwaves(prev => [...prev, id]);

          // Clean up individual shockwave
          setTimeout(() => {
               setShockwaves(prev => prev.filter(s => s !== id));
          }, 1500);

          const t = setTimeout(() => setIsGlowing(false), 800); // 0.8s flash
          return () => clearTimeout(t);
      }
  }, [glowTrigger]);

  // Shooting Star Logic
  useEffect(() => {
    if (sceneMode !== 'space') return; // Only in space

    const scheduleShootingStar = () => {
        // Random interval approx 4 minutes (240000ms) +/- 30s
        const nextDelay = 240000 + (Math.random() * 60000) - 30000; 
        
        const timeout = setTimeout(() => {
            const startTop = Math.random() * 100; 
            const startLeft = Math.random() * 100;
            const angle = Math.random() * 360; // Random angle
            const speed = 0.4 + Math.random() * 0.4; // Fast: 0.4s to 0.8s
            
            setShootingStar({
                id: Date.now(),
                top: `${startTop}%`,
                left: `${startLeft}%`,
                angle: angle,
                duration: `${speed}s`
            });

            // Cleanup star after animation
            setTimeout(() => setShootingStar(null), speed * 1000 + 100);
            
            // Schedule next one
            scheduleShootingStar();
        }, nextDelay);

        return timeout;
    };

    // Initial check (faster start for effect, then loop long)
    const initialTimer = setTimeout(() => {
         const startTop = Math.random() * 80 + 10;
         const startLeft = Math.random() * 80 + 10;
         setShootingStar({
            id: Date.now(),
            top: `${startTop}%`,
            left: `${startLeft}%`,
            angle: 45,
            duration: '0.6s'
         });
         setTimeout(() => setShootingStar(null), 700);
         scheduleShootingStar();
    }, 5000); // First star after 5s

    return () => clearTimeout(initialTimer);
  }, [sceneMode]);

  // UFO Logic (Every ~6 minutes)
  useEffect(() => {
      if (sceneMode !== 'space') return;

      const scheduleUfo = () => {
          // 6 minutes = 360000ms. Add some variance.
          const delay = 360000 + (Math.random() * 60000); 
          
          const timer = setTimeout(() => {
              // Randomly decide if it's a standard flyby (left to right) or the casual return (right to left, receding)
              const type = Math.random() > 0.5 ? 'flyby' : 'return';
              
              setUfoConfig({
                  startY: 10 + Math.random() * 30, // Start high in background
                  endY: 40 + Math.random() * 40,    // End lower in foreground
                  type: type
              });
              setUfoActive(true);

              // Animation Duration is ~20s
              setTimeout(() => {
                  setUfoActive(false);
                  scheduleUfo(); // Schedule next
              }, 25000); // Cleanup after animation
          }, delay);
          
          return timer;
      };
      
      // Start the loop
      const initialUfo = scheduleUfo();
      return () => clearTimeout(initialUfo);
  }, [sceneMode]);


  // Ambient Ships (Visual Only)
  const ships = useMemo(() => Array.from({ length: 12 }).map((_, i) => {
    const isGreen = Math.random() > 0.5;
    const direction = Math.random() > 0.5 ? 1 : -1; 
    
    const startY = Math.random() * 100;
    const endY = Math.random() * 100;
    
    const duration = 15 + Math.random() * 20; 
    const delay = Math.random() * 20;
    const size = 0.5 + Math.random() * 0.5; 

    const dx = 120 * direction; 
    const dy = endY - startY; 
    const rotation = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI); 
    const visualRotation = direction === 1 ? rotation : (rotation + 180);

    return {
        id: i,
        // Visual only, no interaction classes
        wrapperClass: 'absolute flex items-center justify-center animate-fly-ambient',
        wrapperStyle: {
            top: '0px',
            left: '0px',
            width: '60px', 
            height: '60px',
            '--start-x': direction === 1 ? '-10vw' : '110vw',
            '--end-x': direction === 1 ? '110vw' : '-10vw',
            '--start-y': `${startY}vh`,
            '--end-y': `${endY}vh`,
            '--rot': `${visualRotation}deg`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite'
        } as React.CSSProperties,
        // Inner contains the tiny visual ship
        innerClass: isGreen 
            ? 'bg-green-400 shadow-[0_0_4px_#4ade80]' 
            : 'bg-blue-400 shadow-[0_0_4px_#60a5fa]',
        innerStyle: {
            width: `${4 * size}px`,
            height: `${3 * size}px`,
            borderRadius: '50%',
            opacity: 0.6,
        }
    };
  }), []);

  // Pre-calculate ring numbers positions
  const ringNumbers = useMemo(() => {
      const radius = 380; // Distance from center of planet
      return ROULETTE_NUMBERS.map((num, i) => {
          const angleDeg = (i * 360) / ROULETTE_NUMBERS.length;
          const color = NUMBER_COLORS[num.toString()];
          const colorClass = color === 'red' ? 'text-red-500' : (color === 'black' ? 'text-gray-400' : 'text-green-500');
          return { num, angleDeg, colorClass, radius };
      });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 bg-black">
      
      {/* SPACE MODE BACKGROUND */}
      {sceneMode === 'space' && (
         <>
             <div className="absolute inset-0 bg-[#050011]" /> 
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,#020617_100%)] opacity-80" />
             <VolumetricRays />
         </>
      )}

      {/* BRAIN MODE BACKGROUND */}
      {sceneMode === 'brain' && (
         <div className="absolute inset-0 animate-drift-slow overflow-hidden">
             {/* Deep Organic Background */}
             <div className="absolute inset-0 bg-[#080214]" />
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#2e003b_0%,#080214_80%)] opacity-60" />
             
             {/* Synapse Layer (SVG) */}
             <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                     <filter id="glow-synapse" x="-50%" y="-50%" width="200%" height="200%">
                         <feGaussianBlur stdDeviation="0.4" result="blur" />
                         <feMerge>
                             <feMergeNode in="blur" />
                             <feMergeNode in="SourceGraphic" />
                         </feMerge>
                     </filter>
                     {/* Gradient for Lines */}
                     <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4c1d95" stopOpacity="0.1" />
                        <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.1" />
                     </linearGradient>
                </defs>
                {synapses.map((syn, i) => (
                    <g key={syn.id}>
                        {/* Static Connection Line */}
                        <line 
                            x1={syn.start.x} y1={syn.start.y} 
                            x2={syn.end.x} y2={syn.end.y} 
                            stroke="url(#lineGrad)" 
                            strokeWidth="0.15" 
                        />
                        {/* Firing Impulse - Activity */}
                        {/* Only animate a subset to prevent visual chaos */}
                        {i % 4 === 0 && (
                             <circle r="0.3" fill="#e879f9" filter="url(#glow-synapse)">
                                <animateMotion 
                                    dur={`${2 + Math.random() * 5}s`}
                                    repeatCount="indefinite"
                                    // Use path attribute for smooth interpolation
                                    path={`M ${syn.start.x} ${syn.start.y} L ${syn.end.x} ${syn.end.y}`}
                                    keyPoints="0;1"
                                    keyTimes="0;1"
                                    calcMode="linear"
                                />
                             </circle>
                        )}
                        {/* Reverse Impulse */}
                        {i % 7 === 0 && (
                             <circle r="0.2" fill="#22d3ee" filter="url(#glow-synapse)">
                                <animateMotion 
                                    dur={`${3 + Math.random() * 4}s`}
                                    repeatCount="indefinite"
                                    path={`M ${syn.end.x} ${syn.end.y} L ${syn.start.x} ${syn.start.y}`}
                                    keyPoints="0;1"
                                    keyTimes="0;1"
                                    calcMode="linear"
                                />
                             </circle>
                        )}
                    </g>
                ))}
             </svg>

             {/* Neurons (DOM Elements for easy glow/pulse) */}
             {neurons.map(n => (
                 <div 
                    key={n.id}
                    className="absolute rounded-full bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.6)] animate-pulse"
                    style={{
                        left: `${n.x}%`,
                        top: `${n.y}%`,
                        width: `${n.size}px`,
                        height: `${n.size}px`,
                        transform: 'translate(-50%, -50%)', // Center on coordinate
                        animationDuration: `${n.pulseRate}s`,
                        opacity: 0.8
                    }}
                 >
                    {/* Inner Core */}
                    <div className="absolute inset-[20%] bg-white rounded-full opacity-60" />
                 </div>
             ))}

             {/* Floating Dust Particles for Depth */}
             {Array.from({length: 20}).map((_, i) => (
                 <div 
                    key={i}
                    className="absolute rounded-full bg-violet-400 blur-[1px] opacity-20 animate-float"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        width: `${2 + Math.random() * 4}px`,
                        height: `${2 + Math.random() * 4}px`,
                        animationDuration: `${10 + Math.random() * 20}s`,
                        animationDelay: `-${Math.random() * 10}s`
                    }}
                 />
             ))}
         </div>
      )}

      {/* Static Stars (SPACE MODE ONLY) */}
      {sceneMode === 'space' && stars.map((s, i) => (
        <div
          key={i}
          className="absolute bg-white rounded-full animate-twinkle"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animationDelay: s.delay,
            animationDuration: `${2 + Math.random() * 3}s` 
          }}
        />
      ))}

      {/* SPACE SPECIFIC EFFECTS */}
      {sceneMode === 'space' && (
        <>
            {/* Shooting Star */}
            {shootingStar && (
                <div 
                    className="absolute h-[2px] w-[200px] bg-gradient-to-r from-transparent via-white to-transparent z-10"
                    style={{
                        top: shootingStar.top,
                        left: shootingStar.left,
                        transform: `rotate(${shootingStar.angle}deg)`,
                        animation: `shootingStar ${shootingStar.duration} linear forwards`,
                        boxShadow: '0 0 10px rgba(255,255,255,0.8)'
                    }}
                />
            )}

            {/* UFO Flyby */}
            {ufoActive && ufoConfig && (
                <div 
                    className={`absolute z-20 ${ufoConfig.type === 'return' ? 'animate-ufo-return' : 'animate-ufo-flyby'}`}
                    style={{
                        '--ufo-start-y': `${ufoConfig.startY}vh`,
                        '--ufo-end-y': `${ufoConfig.endY}vh`,
                    } as React.CSSProperties}
                >
                    <div className="relative w-28 h-8">
                        {/* ROTATING RING OF LIGHTS */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 flex items-center justify-center pointer-events-none z-10">
                            <div className="w-full h-full" style={{ transform: 'rotateX(80deg)' }}>
                                <div className="w-full h-full rounded-full border border-cyan-500/30 animate-[spin_4s_linear_infinite]">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]" />
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_10px_red]" />
                                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_10px_green]" />
                                    <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_blue]" />
                                </div>
                            </div>
                        </div>

                        {/* Glass Dome */}
                        <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 w-12 h-5 bg-cyan-200/40 rounded-t-full border border-white/30 backdrop-blur-[1px] overflow-hidden z-20">
                            {/* THE ALIEN DRIVER */}
                            <div className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-5 h-5 flex flex-col items-center justify-end animate-pulse" style={{ animationDuration: '3s' }}>
                                {/* Head */}
                                <div className="w-2.5 h-3 bg-[#4ade80] rounded-[50%_50%_70%_70%] shadow-[0_0_3px_#22c55e] relative z-20">
                                    <div className="absolute top-[35%] left-[0px] w-1.5 h-1.5 bg-black rounded-[60%_40%_40%_40%] -rotate-[30deg] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.6)]" />
                                    <div className="absolute top-[35%] right-[0px] w-1.5 h-1.5 bg-black rounded-[40%_60%_40%_40%] rotate-[30deg] shadow-[inset_-1px_1px_1px_rgba(255,255,255,0.6)]" />
                                </div>
                                <div className="w-0.5 h-1 bg-[#4ade80] -mt-0.5 z-10" />
                                <div className="w-4 h-1.5 bg-green-700 rounded-t-full -mt-0.5 z-10" />
                            </div>
                        </div>

                        {/* VOLUMETRIC BEAMS LAYER */}
                        <div className="absolute top-[50%] -left-[10%] w-[120%] h-40 overflow-hidden z-0" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
                                <div className="w-[200%] h-full flex gap-2 animate-ufo-lights-spin pl-1">
                                    {Array.from({length: 20}).map((_, i) => (
                                        <div key={i} className="w-3 relative flex justify-center">
                                            <div className={`w-8 h-32 bg-gradient-to-b ${i % 3 === 0 ? 'from-red-500/40' : (i % 3 === 1 ? 'from-green-500/40' : 'from-blue-500/40')} to-transparent blur-md origin-top transform -rotate-6`} />
                                        </div>
                                    ))}
                                </div>
                        </div>
                        
                        {/* METALLIC BODY */}
                        <div 
                                className="absolute inset-0 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-800 shadow-2xl border border-gray-500 flex items-center z-20"
                                style={{ 
                                    clipPath: 'polygon(15% 0%, 85% 0%, 100% 30%, 100% 70%, 85% 100%, 15% 100%, 0% 70%, 0% 30%)'
                                }}
                        >
                                <div className="w-[200%] h-1.5 flex gap-3 animate-ufo-lights-spin mt-0.5">
                                    {Array.from({length: 20}).map((_, i) => (
                                        <div key={i} className={`w-2 h-2 rounded-full ${i % 3 === 0 ? 'bg-red-500' : (i % 3 === 1 ? 'bg-green-500' : 'bg-blue-500')} shadow-[0_0_8px_currentColor]`} />
                                    ))}
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none mix-blend-overlay" />
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-green-500/60 blur-xl rounded-full animate-pulse z-0" />
                    </div>
                </div>
            )}

            {/* Ambient Ships */}
            {ships.map((ship) => (
                <div 
                    key={ship.id}
                    data-id={ship.id}
                    className={ship.wrapperClass}
                    style={ship.wrapperStyle}
                >
                    <div className={ship.innerClass} style={ship.innerStyle} />
                </div>
            ))}

            {/* 3D Mechanical Base System */}
            <div className="absolute top-[-10%] right-[-10%] w-[900px] h-[900px]" style={{ perspective: '1200px' }}>
                <div className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
                    
                    {/* SHOCKWAVES */}
                    {shockwaves.map(id => (
                        <div 
                            key={id}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border-[12px] border-cyan-200/80 shadow-[0_0_100px_#22d3ee] z-0 pointer-events-none animate-shockwave"
                            style={{ transformStyle: 'preserve-3d', transform: 'translate(-50%, -50%) translateZ(-50px)' }}
                        />
                    ))}

                    {/* The Mechanical Base (Planet) */}
                    <div 
                        className={`
                            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full 
                            overflow-hidden transition-all duration-300 ease-out
                            ${isGlowing 
                                ? 'shadow-[0_0_200px_rgba(34,211,238,0.95)] border-4 border-white scale-105 brightness-150' 
                                : 'shadow-[0_0_100px_rgba(0,0,0,1)] border-0 border-transparent scale-100 brightness-100'}
                            bg-slate-900
                        `}
                        style={{ transform: 'translate(-50%, -50%) translateZ(0)' }}
                    >
                        {/* Glow Overlay */}
                        <div className={`absolute inset-0 bg-white/40 transition-opacity duration-300 z-50 pointer-events-none mix-blend-screen ${isGlowing ? 'opacity-100' : 'opacity-0'}`} />

                        {/* Metallic Texture Base - Rotating */}
                        <div className="absolute inset-0 bg-[conic-gradient(from_45deg,#1e293b,#334155,#0f172a,#334155,#1e293b)] animate-[spin_120s_linear_infinite]" />
                        
                        {/* Tech Grid Lines (Paneling) */}
                        <div className="absolute inset-0 opacity-20" 
                            style={{ 
                                backgroundImage: `
                                    repeating-linear-gradient(0deg, transparent, transparent 19px, #38bdf8 20px),
                                    repeating-linear-gradient(90deg, transparent, transparent 19px, #38bdf8 20px)
                                ` 
                            }} 
                        />

                        {/* Random Base Lights */}
                        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                        <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-cyan-400 rounded-full blur-[2px] animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 w-32 h-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 bg-white/5 backdrop-blur-[1px]" />
                        
                        {/* Core Reactor Glow */}
                        <div className="absolute top-[60%] left-[30%] w-16 h-16 bg-cyan-500/30 rounded-full blur-xl animate-pulse" />

                        {/* 3D Shading Overlay (Base) */}
                        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1)_0%,rgba(0,0,0,0.5)_50%,rgba(0,0,0,0.95)_100%)]" />

                        {/* Key Light */}
                        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_15%_15%,rgba(220,245,255,0.25)_0%,rgba(100,200,255,0.1)_30%,transparent_65%)] z-10" />

                        {/* Atmosphere Shield */}
                        <div className="absolute inset-0 rounded-full shadow-[inset_0_0_30px_rgba(56,189,248,0.3)] border border-cyan-500/20" />
                    </div>

                    {/* ORBITAL PLANE (Tilted Ring & Moon System) */}
                    <div className="absolute w-full h-full flex items-center justify-center animate-orbit-wobble" 
                        style={{ 
                            transformStyle: 'preserve-3d', 
                        }}
                    >
                        {/* The Surveillance Moon - Orbiting on the Plane */}
                        <div className="absolute w-[580px] h-[580px] flex items-center justify-center" 
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            <div className="absolute w-full h-full" style={{ transformStyle: 'preserve-3d', animation: 'spin 20s linear infinite reverse' }}>
                                <div className="absolute top-1/2 right-0 -mt-4 -mr-4 w-8 h-8 flex items-center justify-center"
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    <div className="w-full h-full flex items-center justify-center"
                                        style={{ 
                                            animation: 'spin 20s linear infinite', 
                                            transformStyle: 'preserve-3d' 
                                        }}
                                    >
                                        <div className="w-full h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] bg-gray-200"
                                            style={{
                                                transform: 'rotateZ(10deg) rotateX(-76deg)',
                                                transformStyle: 'preserve-3d'
                                            }}
                                        >
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rounded-full shadow-[0_0_5px_red] animate-pulse z-10" />
                                            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_20%_20%,#f0f9ff_0%,#bae6fd_20%,#475569_60%,#0f172a_100%)]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* The Data Ring */}
                        <div className="absolute w-[800px] h-[800px] flex items-center justify-center" 
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            <div className="absolute inset-[-50px] rounded-full bg-gradient-to-br from-cyan-300/10 via-transparent to-transparent opacity-40 z-0 pointer-events-none" style={{ transform: 'rotate(-45deg)' }} />

                            <div className="absolute w-full h-full rounded-full"
                                style={{ 
                                    transformStyle: 'preserve-3d', 
                                    animation: 'spin 60s linear infinite' 
                                }}
                            >
                                <div className="absolute inset-0 rounded-full border-[2px] border-cyan-500/10 border-dashed" />
                                <div className="absolute inset-[40px] rounded-full border-[1px] border-cyan-500/5" />
                                <div className="absolute top-0 left-1/2 w-[2px] h-[50%] bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent origin-bottom animate-spin" style={{ animationDuration: '10s' }} />

                                {ringNumbers.map((item, i) => (
                                    <div 
                                        key={i}
                                        className={`absolute top-1/2 left-1/2 flex items-center justify-center ${item.colorClass}`}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            // Position on ring
                                            transform: `rotateZ(${item.angleDeg}deg) translateY(-${item.radius}px) rotateX(-90deg) rotateY(180deg)`
                                        }}
                                    >
                                        <span className="text-xl font-black font-mono tracking-tighter" style={{ textShadow: '0 0 5px rgba(0,0,0,0.8)' }}>
                                            {item.num}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lens Flare / Warzone Haze */}
            <div 
                className="absolute inset-0 z-30 pointer-events-none mix-blend-screen overflow-hidden"
                style={{
                    maskImage: 'linear-gradient(to right, black 0%, black 30%, transparent 85%)',
                    WebkitMaskImage: 'linear-gradient(to right, black 0%, black 30%, transparent 85%)'
                }}
            >
                <div className="absolute -top-[15%] -left-[15%] w-[70%] h-[70%] bg-[radial-gradient(circle_at_center,rgba(168,85,247,1)_0%,rgba(139,92,246,0.7)_30%,rgba(0,0,0,0)_70%)] blur-[90px] animate-pulse" style={{ animationDuration: '6s' }} />
                <div className="absolute top-[5%] left-[5%] w-[15%] h-[15%] bg-white/60 blur-[60px] animate-pulse" style={{ animationDuration: '3s' }} />
                <div className="absolute top-0 left-0 w-[50%] h-[50%] opacity-40 mix-blend-overlay animate-float">
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 via-transparent to-transparent blur-3xl" />
                </div>
                <div className="absolute top-[15%] left-[15%] w-32 h-32 rounded-full bg-fuchsia-500/20 blur-2xl" />
                <div className="absolute top-[25%] left-[25%] w-16 h-16 rounded-full bg-violet-400/30 blur-xl" />
                <div className="absolute top-[40%] left-[40%] w-8 h-8 rounded-full bg-purple-300/40 blur-md" />
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[radial-gradient(circle,rgba(147,51,234,0.2)_0%,transparent_70%)] blur-[100px]" />
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '100% 4px' }} />
            </div>
        </>
      )}

      {/* BRAIN MODE SPECIFIC EFFECTS */}
      {sceneMode === 'brain' && (
           <div className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay opacity-30">
                {/* Additional overlay for Brain Mode integration if needed */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(232,121,249,0.1)_0%,transparent_60%)]" />
           </div>
      )}

    </div>
  );
};

function App() {
  // Config State
  const [startBankroll, setStartBankroll] = useState(1000);
  const [tableMin, setTableMin] = useState(3);
  const [tableMax, setTableMax] = useState(1000);
  const [numSimulations, setNumSimulations] = useState(1); 
  const [maxSpins, setMaxSpins] = useState(50);          
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(2000);
  const [strategyName, setStrategyName] = useState("Strategy 1");
  const [sceneMode, setSceneMode] = useState<'space' | 'brain'>('space');
  
  // Simulation Controls
  const [simSpeed, setSimSpeed] = useState<SimSpeed>('fast');
  const [viewMode, setViewMode] = useState<'builder' | 'simulation'>('builder');
  const [isPlaying, setIsPlaying] = useState(false);
  // Remove separate logFullScreen state as it's now embedded in layout
  const [expandedSpinIndex, setExpandedSpinIndex] = useState<number | null>(null);

  // New: Transition state for resetting strategy
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Planet Glow State
  const [planetGlowTrigger, setPlanetGlowTrigger] = useState(0);

  // --- RECURSIVE TREE STATE ---
  const [rootNode, setRootNode] = useState<StrategyNode>({
      id: 'root',
      type: 'start_immediately',
      label: 'Start Immediately',
      bets: [],
      x: 0,
      y: 0,
      children: { win: null, loss: null }
  });

  // Editor State
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Global Canvas Panning & Zoom State
  const [canvasOffset, setCanvasOffset] = useState({ x: window.innerWidth / 3, y: window.innerHeight / 2 });
  const [zoom, setZoom] = useState(1);
  
  // Key to force reset animation for strategy builder
  const [resetKey, setResetKey] = useState(0);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if user clicked an input/button or select
    const target = e.target as HTMLElement;
    if (target.closest('input') || target.closest('button') || target.closest('select')) {
        return;
    }
    
    // Disable in simulation mode
    if (viewMode === 'simulation') return;

    if (e.button === 0) {
        // LEFT CLICK - PANNING (Was Right, now standard drag)
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        offsetStart.current = { ...canvasOffset };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
      // Handle Panning End
      if (isPanning.current) {
          isPanning.current = false;
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
      }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setCanvasOffset({
        x: offsetStart.current.x + dx,
        y: offsetStart.current.y + dy
    });
  };
  
  const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation(); 
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newZoom = Math.min(Math.max(zoom + delta, 0.1), 3);
      
      if (newZoom === zoom) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const worldX = (cursorX - canvasOffset.x) / zoom;
      const worldY = (cursorY - canvasOffset.y) / zoom;

      const newOffsetX = cursorX - (worldX * newZoom);
      const newOffsetY = cursorY - (worldY * newZoom);

      setZoom(newZoom);
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
  };

  // Results State
  const [allSimResults, setAllSimResults] = useState<{ steps: SimulationStep[], stats: SimulationStats }[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  // --- Recursive Helpers ---
  const findNode = (root: StrategyNode, id: string): StrategyNode | null => {
      if (root.id === id) return root;
      if (root.children.win) {
          const found = findNode(root.children.win, id);
          if (found) return found;
      }
      if (root.children.loss) {
          const found = findNode(root.children.loss, id);
          if (found) return found;
      }
      return null;
  };

  const updateNodeRecursive = (node: StrategyNode, id: string, updates: Partial<StrategyNode>): StrategyNode => {
      if (node.id === id) {
          return { ...node, ...updates };
      }
      return {
          ...node,
          children: {
              win: node.children.win ? updateNodeRecursive(node.children.win, id, updates) : null,
              loss: node.children.loss ? updateNodeRecursive(node.children.loss, id, updates) : null,
          }
      };
  };

  const addChildRecursive = (node: StrategyNode, parentId: string, type: 'win' | 'loss', newNode: StrategyNode): StrategyNode => {
      if (node.id === parentId) {
          return {
              ...node,
              children: {
                  ...node.children,
                  [type]: newNode
              }
          };
      }
      return {
          ...node,
          children: {
              win: node.children.win ? addChildRecursive(node.children.win, parentId, type, newNode) : null,
              loss: node.children.loss ? addChildRecursive(node.children.loss, parentId, type, newNode) : null,
          }
      };
  };

  const editingNode = editingNodeId ? findNode(rootNode, editingNodeId) : null;

  // --- Event Handlers ---
  const handleUpdateNode = (nodeId: string, updates: Partial<StrategyNode>) => {
      setRootNode(prev => updateNodeRecursive(prev, nodeId, updates));
  };

  const handleCreateChild = (parentId: string, type: 'win' | 'loss', initialData: Partial<StrategyNode> = {}, openTable: boolean = false) => {
      const newNode: StrategyNode = {
          id: generateId(),
          type: initialData.type || 'reset',
          label: initialData.label || 'Reset to Start',
          bets: initialData.bets || [],
          x: initialData.x || 0,
          y: initialData.y || 0,
          children: { win: null, loss: null },
          ...initialData
      };

      setRootNode(prev => addChildRecursive(prev, parentId, type, newNode));
      
      if (openTable) {
          setEditingNodeId(newNode.id);
      }
  };

  const handleMoveNode = (nodeId: string, x: number, y: number) => {
      handleUpdateNode(nodeId, { x, y });
  };

  const handleOpenTable = (nodeId: string) => {
      setEditingNodeId(nodeId);
  };

  const handleSaveBets = (bets: PlacedBet[]) => {
      if (editingNodeId && editingNode) {
          const isRoot = editingNodeId === rootNode.id;
          
          let updates: Partial<StrategyNode> = { bets };
          
          if (!isRoot) {
              // PRESERVE TYPE if it's a wait node, so the sub-node logic stays attached.
              if (editingNode.type === 'wait_spins' || editingNode.type === 'wait_condition') {
                  // Do not overwrite type, just update bets
              } else {
                  updates.type = 'custom_bet';
                  updates.label = 'Custom Bet';
              }
          }

          handleUpdateNode(editingNodeId, updates);
          setEditingNodeId(null);
      }
  };
  
  const handleAutoArrange = () => {
      const newRoot = JSON.parse(JSON.stringify(rootNode));
      
      const traverseLayout = (node: StrategyNode, depth: number, yOffset: number, availableHeight: number) => {
          node.x = depth * 450; 
          node.y = yOffset;

          const nextHeight = availableHeight / 2;
          
          if (node.children.win) {
              traverseLayout(node.children.win, depth + 1, yOffset - nextHeight, nextHeight);
          }
          if (node.children.loss) {
              traverseLayout(node.children.loss, depth + 1, yOffset + nextHeight, nextHeight);
          }
      };

      traverseLayout(newRoot, 0, 0, 400); 

      setRootNode(newRoot);
      setCanvasOffset({ x: 100, y: window.innerHeight / 2 }); 
      setZoom(0.8);
  };

  // --- STRATEGY COMPLETION LOGIC ---
  const checkStrategyComplete = (root: StrategyNode): boolean => {
      const visited = new Set<string>();
      
      const isBranchComplete = (node: StrategyNode): boolean => {
          if (visited.has(node.id)) return true;
          visited.add(node.id);

          if (node.type === 'reset') return true;
          if (!isNodeValid(node)) return false;

          let winComplete = false;
          if (node.children.win) {
              if (node.children.win.id === root.id) winComplete = true; // Loop to root
              else winComplete = isBranchComplete(node.children.win);
          }

          let lossComplete = false;
          if (node.type === 'martingale' && node.martingaleLimitType === 'until_bankrupt') {
              lossComplete = true;
          } else {
              if (node.children.loss) {
                  if (node.children.loss.id === root.id) lossComplete = true; // Loop to root
                  else lossComplete = isBranchComplete(node.children.loss);
              }
          }
          
          return winComplete && lossComplete;
      };

      return isBranchComplete(root);
  };

  // Track validity to trigger glow on completion
  const [isStrategyComplete, setIsStrategyComplete] = useState(false);

  useEffect(() => {
     const complete = checkStrategyComplete(rootNode);
     
     // Trigger ONLY on transition from Incomplete -> Complete
     if (complete && !isStrategyComplete) {
         // Add a small delay to ensure visual updates (lines stopping) happen slightly before or concurrently
         setTimeout(() => setPlanetGlowTrigger(prev => prev + 1), 100);
     }
     setIsStrategyComplete(complete);
  }, [rootNode]);

  const handleNewStrategy = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // 1. Transition Out (Fade away)
    setIsTransitioning(true);

    // 2. Perform Data Reset after fade out
    setTimeout(() => {
        try {
            // --- HARD RESET LOGIC ---
            // Create a completely fresh root object with a unique ID
            const freshRoot: StrategyNode = {
                id: `root-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                type: 'start_immediately',
                label: 'Start Immediately',
                bets: [],
                x: 0,
                y: 0,
                children: { win: null, loss: null }
            };

            // Reset Configs
            setStartBankroll(1000);
            setTableMin(3);
            setTableMax(1000);
            setMaxSpins(50);
            setNumSimulations(1);
            setStopLoss(0);
            setTakeProfit(2000);
            setStrategyName("Strategy 1");
            
            // Reset View State
            setEditingNodeId(null);
            setCanvasOffset({ x: window.innerWidth * 0.15, y: window.innerHeight / 2 });
            setZoom(1);
            setAllSimResults([]);
            setCurrentResultIndex(0);

            // Apply New Root
            setRootNode(freshRoot);
            
            // Crucial: Increment Reset Key to force full component remount (clears all internal node state)
            setResetKey(prev => prev + 1);

            // 3. Transition In (Reveal new state)
            // Note: We removed the manual glow trigger here. 
            // The useEffect above will handle it if/when the strategy becomes valid.
            setTimeout(() => {
                setIsTransitioning(false);
            }, 50);

        } catch (error) {
            console.error("Error during strategy reset:", error);
            // Fallback: recover view even if reset fails
            setIsTransitioning(false);
        }
    }, 300); // Wait for fade out
  };

  // --- SAVE & LOAD STRATEGY ---
  const handleSaveStrategy = () => {
      const data: SavedStrategy = {
          name: strategyName,
          timestamp: Date.now(),
          config: {
              startBankroll,
              tableMin,
              tableMax,
              maxSpins,
              stopLoss,
              takeProfit
          },
          rootNode
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${strategyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleLoadStrategy = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = event.target?.result as string;
              const data = JSON.parse(json) as SavedStrategy;
              
              if (!data.rootNode || !data.config) {
                  alert("Invalid strategy file format.");
                  return;
              }

              setStrategyName(data.name || "Imported Strategy");
              setStartBankroll(data.config.startBankroll);
              setTableMin(data.config.tableMin);
              setTableMax(data.config.tableMax);
              setMaxSpins(data.config.maxSpins);
              setStopLoss(data.config.stopLoss);
              setTakeProfit(data.config.takeProfit);
              setRootNode(data.rootNode);
              
              setCanvasOffset({ x: window.innerWidth / 3, y: window.innerHeight / 2 });
              setZoom(1);
              setResetKey(prev => prev + 1); // Force remount
              // Note: useEffect will detect validity change and trigger glow automatically
              
          } catch (err) {
              console.error(err);
              alert("Failed to load strategy file.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input so same file can be selected again
  };

  const handleGoToSimulation = () => {
    // Just Navigate. The actual run is triggered by "Run Simulation" in the sim view.
    setAllSimResults([]);
    setViewMode('simulation');
    setIsPlaying(false); 
    setPlaybackIndex(0);
    setExpandedSpinIndex(null); 
  };

  const executeSimulationLogic = () => {
    const config: SimConfig = { 
        maxSpins,
        tableMin,
        tableMax
    };

    const strategy: StrategyConfig = {
        rootNode,
        stopLoss,
        takeProfit
    };

    const allResults = [];
    for(let i=0; i<numSimulations; i++) {
        allResults.push(runSimulation(startBankroll, strategy, config));
    }

    allResults.sort((a, b) => a.stats.finalBankroll - b.stats.finalBankroll);
    setAllSimResults(allResults);
    
    const medianIdx = Math.floor(allResults.length / 2);
    setCurrentResultIndex(medianIdx);
  };

  const startPlayback = () => {
    setIsPlaying(true);
    if (simSpeed === 'fast') {
        const currentSim = allSimResults[currentResultIndex];
        if (currentSim) {
            setPlaybackIndex(currentSim.steps.length);
        }
    } else {
        setPlaybackIndex(0);
    }
  };

  const handleDownloadCSV = () => {
    const currentSim = allSimResults[currentResultIndex];
    if (!currentSim) return;

    const { steps, stats } = currentSim;
    const headers = "Spin Index,Result Number,Result Color,Bet Total,Payout,Bankroll,Won,Action Type\n";
    
    const rows = steps.map(s => 
        `${s.spinIndex},${s.result.number},${s.result.color},${s.betTotal},${s.payout},${s.bankroll},${s.won ? 'TRUE' : 'FALSE'},${s.actionType || ''}`
    ).join('\n');

    const summary = `\n\nSUMMARY STATISTICS\nInitial Bankroll,${stats.initialBankroll}\nFinal Bankroll,${stats.finalBankroll}\nTotal Spins,${stats.totalSpins}\nWins,${stats.wins}\nLosses,${stats.losses}\nROI,${stats.roi.toFixed(2)}%\nMax Drawdown,${stats.maxDrawdown}\nLongest Loss Streak,${stats.longestLossStreak}`;

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows + summary);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `simulation_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentSim = allSimResults[currentResultIndex];
  
  // Playback Control Effects
  useEffect(() => {
      if (viewMode !== 'simulation' || !currentSim || !isPlaying) return;

      if (simSpeed === 'fast') {
          if (playbackIndex !== currentSim.steps.length) {
              setPlaybackIndex(currentSim.steps.length);
          }
          return;
      }

      if (simSpeed === 'medium') {
          const id = setInterval(() => {
              setPlaybackIndex(prev => {
                  if (prev < currentSim.steps.length) return prev + 1;
                  setIsPlaying(false); // Stop at end
                  return prev; 
              });
          }, 2000); // Medium is now slower (2000ms)
          return () => clearInterval(id);
      }
  }, [viewMode, simSpeed, currentSim, playbackIndex, isPlaying]);

  // Spacebar Listener for Slow Mode
  useEffect(() => {
      if (viewMode === 'simulation' && simSpeed === 'slow' && currentSim && isPlaying) {
          const handleKey = (e: KeyboardEvent) => {
              if (e.code === 'Space') {
                  e.preventDefault();
                  setPlaybackIndex(prev => {
                      if (prev >= currentSim.steps.length) {
                          setIsPlaying(false);
                          return prev;
                      }
                      return prev + 1;
                  });
              }
          };
          window.addEventListener('keydown', handleKey);
          return () => window.removeEventListener('keydown', handleKey);
      }
  }, [viewMode, simSpeed, currentSim, isPlaying]);

  useEffect(() => {
      // When switching between simulations results, reset or jump depending on current status
      if (currentSim) {
           if (isPlaying && simSpeed === 'fast') setPlaybackIndex(currentSim.steps.length);
           else if (!isPlaying) setPlaybackIndex(0);
      }
  }, [currentResultIndex, currentSim]);

  const displayedSteps = useMemo(() => {
      if (!currentSim) return [];
      return currentSim.steps.slice(0, playbackIndex);
  }, [currentSim, playbackIndex]);

  const displayedStats = useMemo(() => {
      if (!currentSim) return null;
      // If we haven't started playing, show initial state
      if (playbackIndex === 0) {
        return {
            ...currentSim.stats,
            wins: 0,
            losses: 0,
            longestWinStreak: 0,
            longestLossStreak: 0,
            maxDrawdown: 0,
            maxUpside: 0,
            finalBankroll: currentSim.stats.initialBankroll,
            totalSpins: 0,
            roi: 0
        };
      }
      
      if (playbackIndex >= currentSim.steps.length) return currentSim.stats;
      
      let wins = 0;
      let losses = 0;
      let currentWinStreak = 0;
      let currentLossStreak = 0;
      let longestWinStreak = 0;
      let longestLossStreak = 0;
      let maxDrawdown = 0;
      let maxUpside = 0;
      let bankroll = currentSim.stats.initialBankroll;
      const initial = bankroll;

      displayedSteps.forEach(step => {
           if (step.won) {
               wins++;
               currentWinStreak++;
               currentLossStreak = 0;
           } else {
               losses++;
               currentLossStreak++;
               currentWinStreak = 0;
           }
           if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
           if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
           
           bankroll = step.bankroll;
           const diff = bankroll - initial;
           if (diff < maxDrawdown) maxDrawdown = diff;
           if (diff > maxUpside) maxUpside = diff;
      });

      return {
          ...currentSim.stats,
          wins,
          losses,
          longestWinStreak,
          longestLossStreak,
          maxDrawdown,
          maxUpside,
          finalBankroll: bankroll,
          totalSpins: displayedSteps.length,
          roi: initial > 0 ? ((bankroll - initial) / initial) * 100 : 0
      };

  }, [currentSim, displayedSteps, playbackIndex]);

  // --- Inject Animation Styles ---
  useEffect(() => {
    if (!document.getElementById('anim-styles')) {
        const style = document.createElement('style');
        style.id = 'anim-styles';
        style.innerHTML = `
            @keyframes twinkle {
                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
            }
            .animate-twinkle {
                animation: twinkle 3s ease-in-out infinite;
            }
            @keyframes shootingStar {
                0% { transform: translateX(0) scale(1); opacity: 1; }
                70% { opacity: 1; }
                100% { transform: translateX(1000px) scale(0.1); opacity: 0; }
            }
            .animate-shooting-star {
                /* Animation duration is dynamic inline */
            }
            @keyframes textShimmer {
                0% { background-position: 0% center; }
                100% { background-position: 200% center; }
            }
            .animate-text-shimmer {
                background: linear-gradient(to right, #fbbf24 20%, #ffffff 40%, #fbbf24 60%, #22d3ee 80%, #fbbf24 100%);
                background-size: 200% auto;
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: textShimmer 3s linear infinite;
                filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.4));
            }
            /* Slow, smooth wobble for the ring system */
            @keyframes orbitWobble {
                0% { transform: rotateX(76deg) rotateZ(-10deg); }
                50% { transform: rotateX(72deg) rotateZ(-5deg); }
                100% { transform: rotateX(76deg) rotateZ(-10deg); }
            }
            .animate-orbit-wobble {
                animation: orbitWobble 24s ease-in-out infinite;
            }
            
            /* UFO Animation Keyframes - Standard Flyby (Left to Right) */
            @keyframes ufoFlyBy {
                0% {
                    transform: translate3d(50%, -20vh, -1000px) scale(0.05); /* Start small, deep background */
                    opacity: 0;
                    filter: blur(4px);
                }
                10% {
                    opacity: 1;
                }
                100% {
                     transform: translate3d(-20%, 60vh, 200px) scale(2.0); /* End large, foreground, casual exit */
                     opacity: 1;
                     filter: blur(0);
                }
            }
            .animate-ufo-flyby {
                animation: ufoFlyBy 25s ease-in-out forwards;
                top: 0;
                right: 0;
            }

            /* UFO Animation Keyframes - Return Trip (Right to Left, Leaving) */
            @keyframes ufoReturn {
                0% {
                    transform: translate3d(-10vw, 40vh, 100px) scale(1.5); /* Start Right (foreground) */
                    opacity: 1;
                    filter: blur(0);
                }
                100% {
                     transform: translate3d(120vw, 20vh, -3000px) scale(0.1); /* End Left (deep background) */
                     opacity: 0;
                     filter: blur(3px);
                }
            }
            .animate-ufo-return {
                animation: ufoReturn 25s ease-in-out forwards;
                top: 0;
                right: 0;
            }

            @keyframes ufoLightsSpin {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
            .animate-ufo-lights-spin {
                animation: ufoLightsSpin 1s linear infinite;
            }

            /* Light Ray Animation */
            @keyframes rayPulse {
                0% { opacity: 0.3; transform: rotate(-45deg) translateX(0px); }
                50% { opacity: 0.7; transform: rotate(-43deg) translateX(10px); }
                100% { opacity: 0.3; transform: rotate(-45deg) translateX(0px); }
            }
            .animate-ray-pulse {
                animation: rayPulse 6s ease-in-out infinite;
            }

            /* SHOCKWAVE ANIMATION */
            @keyframes shockwave {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; border-width: 6px; }
                100% { transform: translate(-50%, -50%) scale(3); opacity: 0; border-width: 0px; }
            }
            .animate-shockwave {
                animation: shockwave 1.2s cubic-bezier(0, 0, 0.2, 1) forwards;
            }

            /* GEARS & DUST ANIMATIONS */
            @keyframes spinSlow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .animate-spin-slow {
                animation: spinSlow 60s linear infinite;
            }
            @keyframes spinReverseSlow {
                from { transform: rotate(360deg); }
                to { transform: rotate(0deg); }
            }
            .animate-spin-reverse-slow {
                animation: spinReverseSlow 80s linear infinite;
            }
            @keyframes scanline {
                0% { top: 110%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: -20%; opacity: 0; }
            }
            .animate-scanline {
                animation: scanline 8s linear infinite;
            }
            @keyframes float {
                0% { transform: translateY(0px) translateX(0px); opacity: 0; }
                20% { opacity: 0.5; }
                80% { opacity: 0.5; }
                100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
            }
            .animate-float {
                animation: float 20s linear infinite;
            }
            @keyframes driftSlow {
                0% { transform: scale(1.05) translate(0, 0); }
                50% { transform: scale(1.1) translate(-2%, -2%); }
                100% { transform: scale(1.05) translate(0, 0); }
            }
            .animate-drift-slow {
                animation: driftSlow 30s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }
  }, []);

  let simulationView = null;
  if (viewMode === 'simulation') {
      // --- Render Function using New Component ---
      simulationView = (
          <div className="absolute top-16 left-0 right-0 bottom-0 z-[40] bg-black/85 backdrop-blur-sm flex flex-col animate-fadeIn border-t border-gray-800">
              
              {/* Header (Run Selector & Controls) */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800 bg-gray-900 shadow-md z-10 shrink-0">
                  <div className="flex items-center gap-4">
                      <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                          Simulation Analysis
                      </h2>
                      
                      {/* Simulation Run Selector */}
                      <div className="flex items-center gap-2">
                           <button 
                              disabled={currentResultIndex === 0}
                              onClick={() => { setCurrentResultIndex(prev => Math.max(0, prev - 1)); setIsPlaying(true); }}
                              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          >
                              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <div className="px-3 py-1 bg-gray-800 rounded-lg border border-gray-700 text-xs text-white font-mono font-bold">
                              Run {currentResultIndex + 1} / {allSimResults.length}
                          </div>
                          <button 
                              disabled={currentResultIndex === allSimResults.length - 1}
                              onClick={() => { setCurrentResultIndex(prev => Math.min(allSimResults.length - 1, prev + 1)); setIsPlaying(true); }}
                              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          >
                              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                      </div>

                       <div className="flex items-center gap-1 bg-gray-800 rounded p-1 border border-gray-700 ml-4">
                           <button onClick={() => setSimSpeed('slow')} className={`px-3 py-1 text-xs font-bold uppercase rounded ${simSpeed === 'slow' ? 'bg-yellow-600 text-white' : 'text-gray-500 hover:text-white'}`}>Slow</button>
                           <button onClick={() => setSimSpeed('medium')} className={`px-3 py-1 text-xs font-bold uppercase rounded ${simSpeed === 'medium' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Med</button>
                           <button onClick={() => setSimSpeed('fast')} className={`px-3 py-1 text-xs font-bold uppercase rounded ${simSpeed === 'fast' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-white'}`}>Fast</button>
                      </div>

                      {/* Playback Controls for Slow/Medium */}
                      {simSpeed !== 'fast' && (
                          <div className="flex items-center gap-2 ml-4 border-l border-gray-700 pl-4">
                              <button 
                                  onClick={() => setIsPlaying(!isPlaying)}
                                  className={`px-3 py-1 text-xs font-bold uppercase rounded border transition-colors flex items-center gap-1 ${isPlaying ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600 hover:bg-yellow-600/40' : 'bg-green-600/20 text-green-400 border-green-600 hover:bg-green-600/40'}`}
                              >
                                  {isPlaying ? (
                                      <>
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                                          Pause
                                      </>
                                  ) : (
                                      <>
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                          {playbackIndex === 0 ? 'Start' : 'Resume'}
                                      </>
                                  )}
                              </button>
                              <button 
                                  onClick={() => { setIsPlaying(false); setPlaybackIndex(0); }}
                                  className="px-3 py-1 text-xs font-bold uppercase rounded border border-red-600 text-red-400 bg-red-600/20 hover:bg-red-600/40 transition-colors flex items-center gap-1"
                              >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                                  Cancel
                              </button>
                          </div>
                      )}

                      {simSpeed === 'slow' && playbackIndex < currentSim.steps.length && (
                           <div className="ml-4 text-xs font-bold text-yellow-400 animate-pulse border border-yellow-600 px-2 py-1 rounded bg-yellow-900/20">
                               PRESS SPACEBAR TO SPIN
                           </div>
                      )}
                       
                  </div>
                  
                  <div className="flex items-center gap-4">
                       {/* RUN SIMULATION BUTTON */}
                       <button 
                          onClick={() => {
                              executeSimulationLogic();
                              setIsPlaying(true);
                              setPlaybackIndex(0);
                          }}
                          className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold uppercase text-xs shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                      >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          Run Sim
                      </button>
                  </div>
              </div>

              {/* LIVE SPIN TICKER (For Medium/Slow Speeds) */}
              {simSpeed !== 'fast' && (
                  <RecentSpinsDisplay steps={displayedSteps} />
              )}

              {/* MAIN CONTENT ROW */}
              <div className="flex-1 flex overflow-hidden min-h-0 bg-transparent">
                  
                  {/* LEFT COLUMN: CHART (75%) */}
                  <div className="flex-[3] relative border-r border-gray-800 flex flex-col bg-transparent">
                       <div className="flex-1 min-h-0 relative p-4">
                          {currentSim && (
                            <SimulationChart 
                                data={displayedSteps} 
                                startBankroll={currentSim.stats.initialBankroll} 
                                maxSpins={currentSim.stats.totalSpins}
                            />
                          )}
                       </div>
                       {currentSim && displayedStats && (
                         <div className="px-6 py-2 border-t border-gray-800 bg-gray-900/50 text-xs text-gray-500 font-mono text-center">
                            Current Bankroll: <span className={`font-bold text-lg ml-2 ${displayedStats.finalBankroll >= startBankroll ? 'text-green-400' : 'text-red-400'}`}>${displayedStats.finalBankroll}</span>
                            <span className="mx-3 opacity-30">|</span>
                            Net Profit: <span className={`font-bold ml-2 ${displayedStats.finalBankroll - startBankroll >= 0 ? 'text-green-400' : 'text-red-400'}`}>${displayedStats.finalBankroll - startBankroll}</span>
                         </div>
                       )}
                  </div>

                  {/* RIGHT COLUMN: STATS & LOG (25%) */}
                  <div className="flex-1 flex flex-col bg-gray-900/80 min-w-[300px] border-l border-gray-700">
                      
                      {/* STAT CARDS GRID */}
                      {displayedStats && (
                        <div className="p-4 grid grid-cols-2 gap-3 border-b border-gray-800 bg-gray-900 shadow-md z-10">
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex flex-col">
                                <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Total Spins</span>
                                <span className="text-xl font-mono text-white font-bold leading-none">{displayedStats.totalSpins}</span>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex flex-col">
                                <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Wins / Losses</span>
                                <span className="text-xl font-mono text-white font-bold leading-none">
                                    <span className="text-green-400">{displayedStats.wins}</span>
                                    <span className="text-gray-600 mx-1">/</span>
                                    <span className="text-red-400">{displayedStats.losses}</span>
                                </span>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex flex-col">
                                <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Max Drawdown</span>
                                <span className="text-lg font-mono text-red-400 font-bold leading-none">
                                    {displayedStats.maxDrawdown === 0 ? '-' : `+$${Math.abs(displayedStats.maxDrawdown)}`}
                                </span>
                            </div>
                             <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex flex-col">
                                <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Max Upside</span>
                                <span className="text-lg font-mono text-green-400 font-bold leading-none">
                                     {displayedStats.maxUpside === 0 ? '-' : `+$${displayedStats.maxUpside}`}
                                </span>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex flex-col">
                                <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Win Streak</span>
                                <span className="text-lg font-mono text-green-500 font-bold leading-none">{displayedStats.longestWinStreak}</span>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex flex-col">
                                <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">Loss Streak</span>
                                <span className="text-lg font-mono text-red-500 font-bold leading-none">{displayedStats.longestLossStreak}</span>
                            </div>
                        </div>
                      )}

                      {/* LIVE LAST RESULT DISPLAY */}
                      <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
                           <div className="text-[10px] uppercase font-bold text-gray-500">Last Result</div>
                           {displayedSteps.length > 0 ? (
                              <div className={`px-4 py-2 rounded-lg font-black text-2xl border-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                                  displayedSteps[displayedSteps.length-1].result.color === 'red' ? 'bg-red-600 border-red-400 text-white' : 
                                  displayedSteps[displayedSteps.length-1].result.color === 'black' ? 'bg-gray-800 border-gray-500 text-white' : 
                                  'bg-green-600 border-green-400 text-white'
                              }`}>
                                  {displayedSteps[displayedSteps.length-1].result.number}
                              </div>
                           ) : (
                              <span className="text-xs text-gray-600 italic">Waiting...</span>
                           )}
                      </div>

                      {/* SPIN LOG */}
                      <div className="flex-1 flex flex-col min-h-0 bg-black/40">
                           <div className="flex justify-between items-center px-4 py-2 bg-gray-800/80 border-b border-gray-700 text-[10px] font-bold uppercase text-gray-400">
                              <span>Spin Log</span>
                              {displayedSteps.length > 0 && <span>Latest: #{displayedSteps[displayedSteps.length-1].spinIndex}</span>}
                              <button 
                                  onClick={() => {
                                      // Toggle fullscreen if needed
                                  }}
                                  className="hidden" 
                              >
                                  Full Screen
                              </button>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto font-mono text-xs p-0">
                               {/* Log Header */}
                               <div className="grid grid-cols-12 gap-2 text-gray-500 py-2 px-4 bg-gray-900 border-b border-gray-800 text-[9px] uppercase font-bold sticky top-0 z-10 shadow-sm">
                                  <div className="col-span-1">#</div>
                                  <div className="col-span-2">Res</div>
                                  <div className="col-span-4 text-center">Bets</div>
                                  <div className="col-span-3 text-right">Net</div>
                                  <div className="col-span-2 text-right">Bank</div>
                              </div>
                              
                              {displayedSteps.map(step => (
                                  <div key={step.spinIndex} className="border-b border-gray-800/30">
                                      <div 
                                          className={`grid grid-cols-12 gap-2 py-2 px-4 items-center hover:bg-white/5 transition-colors cursor-pointer ${expandedSpinIndex === step.spinIndex ? 'bg-white/5' : ''}`}
                                          onClick={() => setExpandedSpinIndex(expandedSpinIndex === step.spinIndex ? null : step.spinIndex)}
                                      >
                                          <div className="col-span-1 text-gray-500">{step.spinIndex}</div>
                                          <div className={`col-span-2 font-bold flex items-center gap-1.5 ${
                                              step.result.color === 'red' ? 'text-red-500' : 
                                              step.result.color === 'black' ? 'text-gray-400' : 'text-green-500'
                                          }`}>
                                              {step.result.number}
                                          </div>
                                          <div className="col-span-4 text-[9px] text-gray-400 truncate text-center">
                                              {step.bets.length > 0 ? (
                                                   <span className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                                                      {step.bets.length}
                                                   </span>
                                              ) : <span className="opacity-20">-</span>}
                                          </div>
                                          <div className="col-span-3 text-right">
                                              <div className={`font-bold ${step.net > 0 ? 'text-green-400' : (step.net < 0 ? 'text-red-400' : 'text-gray-500')}`}>
                                                  {step.net > 0 ? '+' : ''}{step.net}
                                              </div>
                                          </div>
                                          <div className={`col-span-2 text-right font-bold ${step.bankroll >= startBankroll ? 'text-green-400' : 'text-red-400'}`}>
                                              ${step.bankroll}
                                          </div>
                                      </div>
                                      
                                      {/* EXPANDED DETAIL VIEW */}
                                      {expandedSpinIndex === step.spinIndex && step.outcomes && step.outcomes.length > 0 && (
                                          <div className="bg-black/40 px-4 py-2 text-[10px] animate-fadeIn border-t border-gray-800/50 shadow-inner">
                                              <div className="mb-2 flex justify-between text-gray-500 uppercase font-bold text-[9px] border-b border-gray-700/50 pb-1">
                                                  <span>Target</span>
                                                  <span>Outcome</span>
                                              </div>
                                              {step.outcomes.map((outcome, idx) => (
                                                  <div key={idx} className="flex justify-between items-center py-0.5">
                                                      <span className="text-gray-300">
                                                          {outcome.bet.label || outcome.bet.type} <span className="text-gray-600">(${outcome.bet.amount})</span>
                                                      </span>
                                                      <span className={`font-bold ${outcome.won ? 'text-green-400' : 'text-red-500/60'}`}>
                                                          {outcome.won ? `+$${outcome.payout}` : `-$${outcome.bet.amount}`}
                                                      </span>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              ))}
                           </div>
                      </div>

                      {/* DOWNLOAD BUTTON */}
                      <div className="p-4 border-t border-gray-800 bg-gray-900">
                           <button 
                              onClick={handleDownloadCSV}
                              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold uppercase text-xs shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              Download CSV
                          </button>
                      </div>
                  </div>

              </div>
          </div>
      );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-gray-200 font-sans select-none relative" onMouseUp={(e) => handleMouseUp(e.nativeEvent)}>
        <BackgroundEffects glowTrigger={planetGlowTrigger} sceneMode={sceneMode} />

        {/* TOP TOOLBAR (Unified Config - Always Visible) */}
        <div className="absolute top-0 left-0 right-0 z-50 min-h-[4rem] h-auto py-1 bg-gray-900/80 backdrop-blur-md border-b border-gray-700 flex items-center justify-between px-6 shadow-2xl">
            {/* Left: Title & Strategy Name */}
            <div className="flex items-center gap-6">
                <div className="flex flex-col items-start mr-4">
                    <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter animate-text-shimmer select-none whitespace-nowrap hidden sm:block transform hover:scale-105 transition-transform duration-300 leading-none">
                        Soulman's Strategy Builder
                    </h1>
                    {/* Scene Toggle */}
                    <div className="flex items-center gap-1 mt-1 bg-gray-800/50 rounded-full p-0.5 border border-gray-700/50">
                       <button 
                           onClick={() => setSceneMode('space')} 
                           className={`text-[9px] font-bold uppercase px-3 py-0.5 rounded-full transition-all duration-300 ${sceneMode === 'space' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                           Space Scene
                       </button>
                       <button 
                           onClick={() => setSceneMode('brain')} 
                           className={`text-[9px] font-bold uppercase px-3 py-0.5 rounded-full transition-all duration-300 ${sceneMode === 'brain' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/50 shadow-[0_0_10px_rgba(232,121,249,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                           Brain Mode
                       </button>
                    </div>
                </div>
                
                <div className="h-8 w-[1px] bg-gray-700 hidden sm:block" />
                
                {/* Strategy Input - Separated from buttons for neatness */}
                <div className="bg-black/40 p-1 rounded-lg border border-gray-700/50">
                    <input 
                        type="text" 
                        value={strategyName}
                        onChange={(e) => setStrategyName(e.target.value)}
                        className="bg-transparent text-white font-bold px-2 py-0.5 text-sm outline-none w-32 sm:w-40 placeholder-gray-500"
                        placeholder="Strategy Name"
                    />
                </div>

                {/* Strategy Actions Group - Plus Button moved here */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-gray-700/50">
                    {/* NEW STRATEGY BUTTON (Plus Sign) - Next to Save/Load */}
                    <button 
                        onClick={handleNewStrategy} 
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" 
                        title="New Strategy"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16M4 12h16" />
                        </svg>
                    </button>

                    <button onClick={handleSaveStrategy} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Save Strategy">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Load Strategy">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </button>
                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadStrategy} className="hidden" />
                    
                    <div className="w-[1px] h-4 bg-gray-600 mx-1" />
                    
                    <button onClick={handleAutoArrange} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="Auto Arrange Layout">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </button>
                </div>
            </div>

            {/* Right: Simulation Config & Controls */}
            <div className="flex items-center gap-6">
                 <div className="flex items-center gap-4 bg-black/60 px-4 py-2 rounded-xl border border-gray-600">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bankroll</span>
                        <input type="number" value={startBankroll} onChange={e => setStartBankroll(Number(e.target.value))} className="w-20 bg-transparent text-green-300 font-mono text-base font-black outline-none border-b border-gray-500 focus:border-green-400" />
                    </div>
                    <div className="w-[1px] h-8 bg-gray-600" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Spins</span>
                        <input type="number" value={maxSpins} onChange={e => setMaxSpins(Number(e.target.value))} className="w-16 bg-transparent text-cyan-200 font-mono text-base font-black outline-none border-b border-gray-500 focus:border-cyan-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Runs</span>
                        <input type="number" value={numSimulations} onChange={e => setNumSimulations(Math.min(100, Math.max(1, Number(e.target.value))))} className="w-14 bg-transparent text-purple-200 font-mono text-base font-black outline-none border-b border-gray-500 focus:border-purple-400" />
                    </div>
                    <div className="w-[1px] h-8 bg-gray-600" />
                     <div className="flex flex-col">
                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Stop Loss</span>
                        <input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} className="w-20 bg-transparent text-red-200 font-mono text-base font-black outline-none border-b border-gray-500 focus:border-red-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Take Profit</span>
                        <input type="number" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} className="w-20 bg-transparent text-green-200 font-mono text-base font-black outline-none border-b border-gray-500 focus:border-green-400" />
                    </div>
                 </div>

                 {/* GLOBAL VIEW TOGGLE BUTTON */}
                 <button 
                    onClick={() => {
                        if (viewMode === 'builder') {
                            handleGoToSimulation();
                        } else {
                            setViewMode('builder');
                        }
                    }}
                    className="px-6 py-2 font-bold rounded uppercase text-xs shadow-lg transition-transform border bg-blue-600 hover:bg-blue-500 text-white active:scale-95 border-blue-400"
                    title="Switch View"
                >
                    {viewMode === 'builder' ? 'Sim Page' : 'Nodes Page'}
                </button>
                
                <div className="w-[1px] h-8 bg-gray-700" />

                <BackgroundAudio url={BACKGROUND_MUSIC_URL} />
            </div>
        </div>

        {/* Floating Laser / Audio Instructions (Bottom Left now) */}
        {viewMode === 'builder' && (
            <div className="absolute bottom-4 left-4 z-40 flex flex-col gap-2 pointer-events-none">
                 <div className="bg-black/40 backdrop-blur-md border border-gray-700 rounded-lg px-3 py-2 text-[10px] font-mono text-gray-400 shadow-lg pointer-events-auto">
                    <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full border border-gray-500" />
                         <span className="text-white font-bold">Left Click (Drag)</span> to Pan View
                    </div>
                 </div>
            </div>
        )}

        {/* Main Content Area */}
        <div className={`absolute inset-0 z-10 transition-all duration-300 ease-in-out transform ${isTransitioning ? 'opacity-0 scale-90 blur-md translate-y-8 pointer-events-none' : 'opacity-100 scale-100 blur-0 translate-y-0'}`}>
            {viewMode === 'builder' ? (
                <>
                    <div 
                        key={`builder-container-${resetKey}`} // Add key here too for safety
                        className="w-full h-full overflow-hidden cursor-crosshair relative pt-16" // Added pt-16 to offset fixed header
                        onMouseDown={handleMouseDown}
                        onWheel={handleWheel}
                    >
                        <StrategyFlowBuilder 
                            key={resetKey}
                            rootNode={rootNode}
                            startBankroll={startBankroll}
                            onUpdateNode={handleUpdateNode}
                            onCreateNode={handleCreateChild}
                            onOpenTable={handleOpenTable}
                            onMoveNode={handleMoveNode}
                            canvasOffset={canvasOffset}
                            zoom={zoom}
                            sceneMode={sceneMode}
                        />
                    </div>
                </>
            ) : (
               simulationView
            )}
        </div>

        {/* Modal for Betting Table */}
        <TableModal 
            isOpen={!!editingNodeId}
            initialBets={editingNode?.bets || []}
            onClose={() => setEditingNodeId(null)}
            onSave={handleSaveBets}
            startBankroll={startBankroll}
            onInteraction={(x, y) => {
                // Pass interaction to keep audio alive if needed
            }}
        />

    </div>
  );
}

export default App;
