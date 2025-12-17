import { GoogleGenerativeAI } from "@google/generative-ai";

// --- THE FIX: This forces the app to find the key ---
const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  import.meta.env.REACT_APP_GEMINI_API_KEY ||
  "";

// Helper for Audio Processing
export const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export class GeminiLiveService {
  private ai: GoogleGenerativeAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  
  constructor() {
    if (!API_KEY) {
      console.error("API Key not found. Please check Vercel settings.");
      throw new Error("API Key missing.");
    }
    this.ai = new GoogleGenerativeAI(API_KEY);
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000
    });

    const outputAnalyser = this.audioContext.createAnalyser();
    outputAnalyser.fftSize = 256;
    outputAnalyser.connect(this.audioContext.destination);
    
    onAudioData(outputAnalyser);

    // Connection Logic
    console.log("Starting Gemini Service with Key:", API_KEY.substring(0, 5) + "...");
    const model = this.ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    return true; 
  }
  
  async stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
