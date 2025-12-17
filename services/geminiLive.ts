import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. The Key Check
const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  import.meta.env.REACT_APP_GEMINI_API_KEY ||
  "";

export class GeminiLiveService {
  private ai: GoogleGenerativeAI;
  private chat: any;
  private synth: SpeechSynthesis;
  private recognition: any;
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  
  constructor() {
    if (!API_KEY) {
      console.error("API Key missing.");
      throw new Error("API Key missing.");
    }
    this.ai = new GoogleGenerativeAI(API_KEY);
    this.synth = window.speechSynthesis;
    
    // Initialize Gemini Chat
    const model = this.ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are Sarah, a professional, friendly, and efficient AI phone coordinator for a home renovation company. Your goal is to qualify leads and book appointments. Keep your answers short, punchy, and conversational (under 2 sentences). Start by saying 'Hi, thanks for calling! This is Sarah. How can I help with your project today?'" }],
        },
        {
          role: "model",
          parts: [{ text: "Hi, thanks for calling! This is Sarah. How can I help with your project today?" }],
        },
      ],
    });
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // 1. Setup Audio Context (To make the visualizer move)
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    // Create a "Dummy" signal so the visualizer isn't dead flat
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.frequency.value = 0; // Silent movement
    this.oscillator.connect(analyser);
    this.oscillator.start();
    
    // Connect visualizer
    onAudioData(analyser);

    // 2. Setup Speech Recognition (Chrome Native)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser not supported. Please use Chrome.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      console.log("Sarah is listening...");
    };

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      console.log("You said:", text);
      
      // Send to Gemini Brain
      try {
        const result = await this.chat.sendMessage(text);
        const response = result.response.text();
        this.speak(response);
      } catch (error) {
        console.error("Gemini Error:", error);
      }
    };

    // 3. Start everything
    this.recognition.start();
    
    // 4. Initial Greeting
    this.speak("Hi! This is Sarah. How can I help you today?");
    
    return true; 
  }
  
  speak(text: string) {
    // Cancel any previous speech
    this.synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster for natural feel
    utterance.pitch = 1.0;
    
    // Try to find a female voice
    const voices = this.synth.getVoices();
    const femaleVoice = voices.find(v => v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Google US English"));
    if (femaleVoice) utterance.voice = femaleVoice;

    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
    if (this.oscillator) this.oscillator.stop();
    if (this.audioContext) this.audioContext.close();
  }
}
