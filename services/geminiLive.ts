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
  
  // SILENCE TIMER
  private silenceTimer: any = null;
  private currentTranscript: string = "";

  // STATUS REPORTER
  private onStatusUpdate: (msg: string) => void = () => {};

  constructor() {
    this.synth = window.speechSynthesis;
  }

  setStatusListener(callback: (msg: string) => void) {
    this.onStatusUpdate = callback;
  }

  async findWorkingModel() {
    this.onStatusUpdate("Connecting...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) {
            this.onStatusUpdate("Error: API Key Issue");
            return false;
        }
        const data = await response.json();
        const validModel = data.models?.find((m: any) => 
            m.name.includes("gemini") && 
            m.supportedGenerationMethods.includes("generateContent")
        );
        if (validModel) {
            this.modelUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${API_KEY}`;
            return true;
        }
    } catch (e) { this.onStatusUpdate("Error: Connection Failed"); }
    return false;
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    this.isListening = true;
    this.isAgentSpeaking = false;

    // 1. WAKE AUDIO
    this.synth.cancel();
    this.synth.speak(new SpeechSynthesisUtterance(" "));

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
    } catch (e) { this.onStatusUpdate("Error: Mic Blocked"); }

    // 4. SETUP EARS
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        this.onStatusUpdate("Error: Browser Not Supported");
        return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; // CHANGED: Keep open to track interim
    this.recognition.interimResults = true; // CHANGED: We want to see live words
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      if (this.isAgentSpeaking) return;

      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      this.currentTranscript = text;
      
      // VISUAL FEEDBACK
      this.onStatusUpdate(`Hearing: "${text.substring(0, 20)}..."`);

      // RESET TIMER: If you are speaking, cancel the "Stop" command
      if (this.silenceTimer) clearTimeout(this.silenceTimer);

      // START TIMER: If you stop speaking for 1.5 seconds, we assume you are done
      this.silenceTimer = setTimeout(() => {
          this.handleEndOfSpeech(text);
      }, 1500); 
    };

    this.recognition.onend = () => {
        // If it stops but we didn't mean to, restart it (unless agent is talking)
        if (this.isListening && !this.isAgentSpeaking) {
            try { this.recognition.start(); } catch (e) {} 
        }
    };

    this.startMic();

    setTimeout(() => {
        this.speak(activeConfig.firstMessage);
    }, 500);
    
    return true; 
  }

  // FORCE SUBMIT FUNCTION
  async handleEndOfSpeech(finalText: string) {
      if (!finalText || finalText.trim().length < 1) return;
      if (this.isAgentSpeaking) return;

      console.log("Forcing End of Speech:", finalText);
      
      // Stop listening instantly
      this.stopMic();
      
      this.onStatusUpdate("Thinking...");

      try {
        const responseText = await this.askGoogleWithHistory(finalText);
        if (responseText) this.speak(responseText);
      } catch (error) {
        this.onStatusUpdate("Error: Brain Failed");
        this.startMic();
      }
  }

  startMic() {
    if (!this.recognition || this.isAgentSpeaking) return;
    try { 
        this.recognition.start(); 
        this.onStatusUpdate("Listening...");
    } catch (e) {}
  }

  stopMic() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
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
    this.isAgentSpeaking = true;
    this.stopMic(); 
    this.synth.cancel();
    this.onStatusUpdate("Speaking...");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; 
    
    utterance.onend = () => {
        this.isAgentSpeaking = false;
        this.onStatusUpdate("Turn Over. Listening...");
        // Wait 0.5s before reopening ears
        setTimeout(() => {
            if (this.isListening) this.startMic();
        }, 500); 
    };

    this.synth.speak(utterance);
  }

  async stop() {
    this.isListening = false;
    this.isAgentSpeaking = false;
    this.onStatusUpdate("Stopped.");
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
