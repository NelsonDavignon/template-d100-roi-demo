import React, { useState, useRef, useEffect } from 'react';
import { Phone, Square } from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLive'; // Note the ".." to go up one folder
import { activeConfig } from '../config'; // Note the ".." to find the config

export default function Slide2_Solution() {
  const [isActive, setIsActive] = useState(false);
  const geminiService = useRef(new GeminiLiveService());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Visualizer Animation Loop
  const drawVisualizer = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dynamic Color from Config
      const isBlue = activeConfig.primaryColor.includes('blue');
      const isGreen = activeConfig.primaryColor.includes('green');
      let barColor = '234, 179, 8'; // Default Yellow
      if (isBlue) barColor = '59, 130, 246'; 
      if (isGreen) barColor = '34, 197, 94'; 

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;
        ctx.fillStyle = `rgb(${barColor})`; 
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  };

  const handleStart = async () => {
    setIsActive(true);
    await geminiService.current.start((analyser) => {
      drawVisualizer(analyser);
    });
  };

  const handleStop = async () => {
    setIsActive(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    await geminiService.current.stop();
  };

  // Cleanup on unmount (if you switch slides)
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      geminiService.current.stop();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 px-4">
      
      {/* HEADER SECTION (Controlled by Config) */}
      <div className="text-center space-y-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-gray-300 tracking-wide uppercase">
            {activeConfig.agentName} is Online
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-serif tracking-tight leading-none text-white">
          {activeConfig.title}
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          {activeConfig.subtitle}
        </p>
      </div>

      {/* INTERACTIVE DEMO BOX */}
      <div className="relative group w-full max-w-sm mx-auto mt-8">
        {/* Dynamic Glow Effect */}
        <div className={`absolute -inset-1 bg-gradient-to-r ${activeConfig.primaryColor.replace('text-', 'from-').replace('500', '600')} to-white/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000`}></div>
        
        <div className="relative bg-[#111] border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center space-y-6">
            
            {/* Visualizer Circle */}
            <div className="relative">
              {isActive ? (
                <div className={`w-24 h-24 rounded-full bg-white/5 border border-white/20 flex items-center justify-center`}>
                     <canvas ref={canvasRef} width={100} height={50} className="w-16 h-8" />
                </div>
              ) : (
                <div className={`w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
                  <Phone className={`w-10 h-10 ${activeConfig.primaryColor}`} /> 
                </div>
              )}
            </div>

            <div className="space-y-2 text-center">
              <h3 className="text-xl font-semibold text-white">
                {isActive ? `${activeConfig.agentName} is listening...` : "Ready to take the call..."}
              </h3>
              <p className="text-sm text-gray-500 uppercase tracking-widest font-medium">
                 {activeConfig.agentName}
              </p>
            </div>

            {/* Start/Stop Buttons */}
            {!isActive ? (
              <button
                onClick={handleStart}
                className={`w-full py-4 px-6 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2`}
              >
                <Phone className="w-5 h-5" />
                <span>Start Live Demo</span>
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full py-4 px-6 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Square className="w-5 h-5" />
                <span>End Call</span>
              </button>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
