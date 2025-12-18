// SECURE MODE: Reads key from Vercel. 
// UPDATED: Better Voice, Smarter Listening, Full Persona.

const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  "";

export class GeminiLiveService {
  private synth: SpeechSynthesis;
  private recognition: any;
  private modelUrl: string = ""; 

  constructor() {
    this.synth = window.speechSynthesis;
    // Pre-load voices to make sure we find the good ones
    if (typeof window !== 'undefined') {
        window.speechSynthesis.getVoices(); 
    }
  }

  // --- BRAIN FINDER (Keep this, it works) ---
  async findWorkingModel() {
    try {
        console.log("Connecting to Google...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) throw new Error("Key Rejected or Invalid");
        const data = await response.json();
        const validModel = data.models?.find((m: any) => 
            m.name.includes("gemini") && 
            m.supportedGenerationMethods.includes("generateContent")
        );
        if (validModel) {
            console.log("Connected to:", validModel.name);
            this.modelUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${API_KEY}`;
            return true;
        }
        throw new Error("No brains found.");
    } catch (e: any) {
        console.error(e);
        return false;
    }
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    const brainReady = await this.findWorkingModel();
    if (!brainReady) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) {
      console.error("Mic Error", e);
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      console.log("Sarah Heard:", text);

      // --- FIX 1: IGNORE SILENCE/MUMBLES ---
      // If the user didn't say anything meaningful (less than 2 chars), ignore it.
      // This stops the "I didn't catch that" loop.
      if (!text || text.trim().length < 2) return;

      try {
        const responseText = await this.askGoogleDirectly(text);
        if (responseText) this.speak(responseText);
      } catch (error: any) {
        console.error("API Error:", error);
      }
    };

    // Keep her alive (Auto-restart)
    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("Hi! I'm Sarah. How can I help with your home project?");
    return true; 
  }

  async askGoogleDirectly(userText: string) {
    if (!this.modelUrl) return "I am offline.";

    // --- FIX 2: RESTORED PERSONA ---
    const systemPrompt = "You are Sarah, a warm, professional Home Renovation Coordinator for 'Kerr Design Build'. Your goal is to book an appointment. Keep answers short (1-2 sentences max), friendly, and human-like. Do not use asterisks or formatting.";

    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: systemPrompt + " User says: " + userText }] 
        }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
    }
    return ""; // Return empty string instead of error text if confused
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = this.synth.getVoices();
    
    // --- FIX 3: BETTER VOICE SELECTION ---
    // 1. Try to find a "Natural" voice (High Quality)
    // 2. Fallback to Google US English
    // 3. Fallback to any Female voice
    const bestVoice = 
        voices.find(v => v.name.includes("Natural") && v.name.includes("English")) || 
        voices.find(v => v.name.includes("Google US English")) || 
        voices.find(v => v.name.includes("Female"));

    if (bestVoice) {
        utterance.voice = bestVoice;
        // Slow her down slightly to sound more thoughtful
        utterance.rate = 0.9; 
    }
    
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
