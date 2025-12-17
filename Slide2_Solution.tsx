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

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }
    };
  }, []);

  const handleStartDemo = async () => {
    setError(null);
    if (!process.env.API_KEY) {
        setError("API Key missing.");
        return;
    }

    try {
      setIsConnected(true);
      serviceRef.current = new GeminiLiveService(process.env.API_KEY);
      
      await serviceRef.current.start(
        (audioAnalyser) => setAnalyser(audioAnalyser),
        () => setIsConnected(false)
      );
      
    } catch (e) {
      console.error(e);
      setError("Failed to connect to AI Service.");
      setIsConnected(false);
    }
  };

  const handleStopDemo = () => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    setIsConnected(false);
    setAnalyser(null);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 max-w-5xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="bg-brand-gold/10 text-brand-gold px-4 py-1 rounded-full text-sm font-semibold uppercase tracking-wider mb-6 inline-block">
          The Solution
        </div>
        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-brand-text">
          Meet Your New 24/7 <br />
          <span className="text-brand-gold">{config.industry} Coordinator</span>
        </h2>
        <p className="text-xl text-brand-muted max-w-2xl mx-auto mb-12">
          Experience the {config.agent.name} difference. She never sleeps, never misses a call, and converts leads into appointments instantly.
        </p>
      </motion.div>

      <motion.div 
        className="w-full max-w-md bg-brand-card border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {/* Background decorative glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-brand-gold/5 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors duration-500 ${isConnected ? 'bg-brand-gold text-brand-dark' : 'bg-brand-dark border border-brand-gold/30 text-brand-gold'}`}>
                {isConnected ? <MicrophoneIcon className="w-10 h-10 animate-pulse" /> : <PhoneIcon className="w-10 h-10" />}
            </div>

            <div className="h-40 w-full flex items-center justify-center mb-6 relative">
                {isConnected ? (
                    <>
                      <AudioVisualizer isActive={true} isSpeaking={true} analyser={analyser} />
                      <div className="absolute bottom-0 w-full text-center">
                        <p className="text-brand-muted/50 text-xs animate-pulse">
                            (Ask me a question if I don't speak first)
                        </p>
                      </div>
                    </>
                ) : (
                    <div className="text-brand-muted text-sm italic">
                        Ready to take the call...
                    </div>
                )}
            </div>

            <h3 className="text-2xl font-bold mb-2">{config.agent.name}</h3>
            <p className="text-brand-muted text-sm mb-8">AI Project Evaluator</p>

            {!isConnected ? (
                <button 
                    onClick={handleStartDemo}
                    className="w-full py-4 bg-brand-gold hover:bg-yellow-500 text-brand-dark font-bold rounded-xl transition-all shadow-lg shadow-brand-gold/20 flex items-center justify-center gap-2"
                >
                    <PhoneIcon className="w-5 h-5" />
                    Start Live Demo
                </button>
            ) : (
                <button 
                    onClick={handleStopDemo}
                    className="w-full py-4 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <StopIcon className="w-5 h-5" />
                    End Call
                </button>
            )}

            {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
            
            <p className="text-xs text-brand-muted/50 mt-10 italic max-w-xs mx-auto leading-relaxed">
                *Note: Production agents are custom-tuned for stunning realism and quality tailored to your business.
            </p>
        </div>
      </motion.div>
      
      <p className="mt-8 text-sm text-brand-muted opacity-60">
        *Requires microphone access to speak with {config.agent.name}.
      </p>
    </div>
  );
};

export default Slide2_Solution;