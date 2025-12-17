import React, { useState, useEffect, useRef } from 'react';
import { SlideProps } from '../types';
import { motion } from 'framer-motion';
import { GeminiLiveService } from '../services/geminiLive';
import AudioVisualizer from './AudioVisualizer';
import { PhoneIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';

const Slide2_Solution: React.FC<SlideProps> = ({ config }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // --- THE FIX: Check the REAL Vercel Key ---
  // We check if the key exists in the environment variables
  const HAS_API_KEY = 
    import.meta.env.VITE_GEMINI_API_KEY || 
    import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
    import.meta.env.REACT_APP_GEMINI_API_KEY;

  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.stop();
      }
    };
  }, []);

  const handleStartDemo = async () => {
    setError(null);
    
    // Check if key is missing
    if (!HAS_API_KEY) {
      setError("API Key missing. Check Vercel Settings.");
      return;
    }

    try {
      setIsConnected(true);
      serviceRef.current = new GeminiLiveService();
      await serviceRef.current.start((audioAnalyser) => {
        setAnalyser(audioAnalyser);
      });
    } catch (err: any) {
      console.error(err);
      setIsConnected(false);
      setError("Connection failed. Try again.");
    }
  };

  const handleStopDemo = async () => {
    if (serviceRef.current) {
      await serviceRef.current.stop();
    }
    setIsConnected(false);
    setAnalyser(null);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 max-w-5xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <span className="inline-block px-4 py-1 mb-6 text-sm font-bold tracking-wider uppercase rounded-full bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
          The Solution
        </span>
        <h1 className="text-5xl md:text-7xl font-serif font-bold text-brand-text mb-6">
          Meet Your New 24/7 <br />
          <span className="text-brand-gold">{config.industry} Coordinator</span>
        </h1>
        <p className="text-xl md:text-2xl text-brand-muted max-w-3xl mx-auto">
          Experience the {config.name} difference. She never sleeps, never misses a call, 
          and converts leads into appointments instantly.
        </p>
      </motion.div>

      {/* Demo Interface */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative w-full max-w-sm bg-zinc-900/90 backdrop-blur-xl rounded-[2rem] border border-white/10 p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-8">
          {/* Visualizer Circle */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            {isConnected ? (
              <div className="absolute inset-0">
                <AudioVisualizer 
                  isActive={true} 
                  isSpeaking={true} 
                  analyser={analyser} 
                />
              </div>
            ) : (
               <div className="w-24 h-24 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/20">
                 <PhoneIcon className="w-10 h-10 text-brand-gold" />
               </div>
            )}
          </div>

          {/* Status Text */}
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-brand-muted uppercase tracking-widest">
              {isConnected ? "Sarah is listening..." : "Ready to take the call..."}
            </p>
            <h3 className="text-2xl font-bold text-white">Sarah</h3>
            <p className="text-sm text-brand-muted">AI Project Evaluator</p>
          </div>

          {/* Action Button */}
          {!isConnected ? (
            <button
              onClick={handleStartDemo}
              className="group relative w-full flex items-center justify-center gap-3 bg-brand-gold hover:bg-brand-gold-light text-brand-dark font-bold py-4 px-8 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              <PhoneIcon className="w-5 h-5" />
              <span>Start Live Demo</span>
            </button>
          ) : (
            <button
              onClick={handleStopDemo}
              className="w-full flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-4 px-8 rounded-xl border border-red-500/20 transition-all"
            >
              <StopIcon className="w-5 h-5" />
              <span>End Call</span>
            </button>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-xs text-red-400 font-medium animate-pulse">
              {error}
            </p>
          )}
          
          <p className="text-[10px] text-brand-muted/50 italic max-w-[200px] text-center">
            *Note: Production agents are custom-tuned for stunning realism.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Slide2_Solution;
