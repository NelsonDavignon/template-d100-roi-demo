import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  analyser: AnalyserNode | null;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, isSpeaking, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    // Create a buffer for frequency data
    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = analyser ? new Uint8Array(bufferLength) : new Uint8Array(0);

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      // 1. Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // 2. Get Audio Data (if mic is on)
      if (isSpeaking && analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      // 3. Draw the Smooth Circle
      ctx.beginPath();
      // Base radius of the circle
      const radius = 50; 

      // We draw a full circle (0 to 2*PI)
      for (let i = 0; i <= 360; i++) {
        // Map degree to radian
        const radian = (i * Math.PI) / 180;
        
        // Map degree to audio frequency index (approximate)
        const dataIndex = Math.floor((i / 360) * (bufferLength / 2));
        
        // Get volume for this frequency (0-255)
        const value = dataArray[dataIndex] || 0;
        
        // "Damping": Divide value by 4 so it pulses gently, not aggressively
        const offset = value / 4; 

        // Calculate (x,y)
        const x = centerX + (radius + offset) * Math.cos(radian);
        const y = centerY + (radius + offset) * Math.sin(radian);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      
      // 4. Style: Gold Outline, Glow effect
      ctx.strokeStyle = '#D4AF37'; // Brand Gold
      ctx.lineWidth = 3;
      ctx.stroke();

      // Add a soft glow inside
      ctx.fillStyle = 'rgba(212, 175, 55, 0.1)';
      ctx.fill();
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [isActive, isSpeaking, analyser]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={300} 
      className="w-full h-full"
    />
  );
};

export default AudioVisualizer;
