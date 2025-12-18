import { activeConfig } from "../config";

const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  "";

export class GeminiLiveService {
  private synth: SpeechSynthesis;
  private recognition: any;
  private modelUrl: string = ""; 
  private history: { role: string; parts: { text: string }[] }[] = [];
  
  private isListening: boolean = false; 
  private isAgentSpeaking: boolean = false;
  
  // NEW: Function to send status updates to the screen
  private onStatusUpdate: (msg: string) => void = () => {};

  constructor() {
    this.synth = window.speechSynthesis;
  }

  // ALLOW THE UI TO LISTEN TO STATUS UPDATES
  setStatusListener(callback: (msg: string) => void) {
    this.onStatusUpdate = callback;
  }

  async findWorkingModel() {
    this.onStatusUpdate("Connecting to Google...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) {
            this.onStatusUpdate("ERROR: API Key Invalid or Google Down.");
            return false;
        }
        const data = await response.json();
        const validModel = data.models?.find((m: any) => 
            m.name.includes("gemini") && 
            m.supportedGenerationMethods.includes("generateContent")
        );
        if (validModel) {
            this.modelUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${API_KEY}`;
            this.onStatusUpdate("Connected to Brain.");
            return true;
        }
    } catch (e) { 
        this.onStatusUpdate("ERROR: Network Connection Failed.");
        console.error(e); 
    }
    return false;
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    this.isListening = true;
    this.isAgentSpeaking = false;

    // 1. WAKE UP AUDIO
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(" ");
    this.synth.speak(utterance);

    const connected = await this.findWorkingModel();
    if (!connected) return;

    // 2. RESET MEMORY
    this.history = [
        { role: "user", parts: [{ text: activeConfig.systemPrompt }] },
        { role: "model", parts: [{ text: activeConfig.firstMessage }] }
    ];

    // 3. SETUP MIC
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) { 
        this.onStatusUpdate("ERROR: Mic Blocked.");
    }

    // 4. SETUP EARS
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        this.onStatusUpdate("ERROR: Browser not supported.");
        return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false; 
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      if (this.isAgentSpeaking) return;

      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      if (!text || text.trim().length < 1) return;

      this.onStatusUpdate(`Heard: "${text}"`);
      this.stopMic(); 

      try {
        this.onStatusUpdate("Thinking...");
        const responseText = await this.askGoogleWithHistory(text);
        if (responseText) this.speak(responseText);
      } catch (error) {
        this.onStatusUpdate("ERROR: Brain failed to reply.");
        this.startMic();
      }
    };

    this.recognition.onend = () => {
        if (this.isListening && !this.isAgentSpeaking) {
            try { this.recognition.start(); } catch (e) {} 
        }
    };

    this.recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
            this.onStatusUpdate(`Mic Error: ${e.error}`);
        }
    };

    this.startMic();

    setTimeout(() => {
        this.speak(activeConfig.firstMessage);
    }, 500);
    
    return true; 
  }

  startMic() {
    if (!this.recognition || this.isAgentSpeaking) return;
    try { 
        this.recognition.start(); 
        this.onStatusUpdate("Listening...");
    } catch (e) {}
  }

  stopMic() {
    if (!this.recognition) return;
    try { this.recognition.stop(); } catch (e) {}
  }

  async askGoogleWithHistory(userText: string) {
    if (!this.modelUrl) return "I lost connection.";
    this.history.push({ role: "user", parts: [{ text: userText }] });

    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: this.history })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        const answer = data.candidates[0].content.parts[0].text;
        this.history.push({ role: "model", parts: [{ text: answer }] });
        return answer;
    }
    return "";
  }
  
  speak(text: string) {
    this.onStatusUpdate("Speaking...");
    this.isAgentSpeaking = true;
    this.stopMic(); 
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; 
    
    utterance.onend = () => {
        this.isAgentSpeaking = false;
        this.onStatusUpdate("Finished speaking. Listening...");
        setTimeout(() => {
            if (this.isListening) this.startMic();
        }, 200); 
    };

    this.synth.speak(utterance);
  }

  async stop() {
    this.isListening = false;
    this.isAgentSpeaking = false;
    this.onStatusUpdate("Stopped.");
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
