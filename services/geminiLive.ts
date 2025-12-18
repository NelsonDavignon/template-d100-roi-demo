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
  
  // TEXT-BASED TIMER (The most reliable fix)
  private silenceTimer: any = null;
  private currentTranscript: string = "";

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
        if (!response.ok) return false;
        const data = await response.json();
        const validModel = data.models?.find((m: any) => 
            m.name.includes("gemini") && 
            m.supportedGenerationMethods.includes("generateContent")
        );
        if (validModel) {
            this.modelUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${API_KEY}`;
            return true;
        }
    } catch (e) { }
    return false;
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    this.isListening = true;
    this.isAgentSpeaking = false;
    this.currentTranscript = "";

    this.synth.cancel();
    this.synth.speak(new SpeechSynthesisUtterance(" "));

    const connected = await this.findWorkingModel();
    if (!connected) {
        this.onStatusUpdate("Error: API Key / Network");
        return;
    }

    this.history = [
        { role: "user", parts: [{ text: activeConfig.systemPrompt }] },
        { role: "model", parts: [{ text: activeConfig.firstMessage }] }
    ];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) { this.onStatusUpdate("Error: Mic Blocked"); }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; 
    this.recognition.interimResults = true; 
    this.recognition.lang = 'en-US';

    // --- THE LOGIC: RESET TIMER ON EVERY WORD ---
    this.recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        
        if (text && text.trim().length > 0) {
            this.currentTranscript = text;
            this.onStatusUpdate(`Hearing: "${text.substring(0, 20)}..."`);
            
            // 1. Clear the old timer (User is still talking)
            if (this.silenceTimer) clearTimeout(this.silenceTimer);

            // 2. Start a new timer. If no new words come in 1.5s, we SEND.
            this.silenceTimer = setTimeout(() => {
                this.forceSubmit();
            }, 1500);
        }
    };

    this.recognition.onend = () => {
        // Only restart if we are listening AND agent is quiet
        if (this.isListening && !this.isAgentSpeaking) {
            try { this.recognition.start(); } catch (e) {} 
        }
    };

    this.startMic();
    setTimeout(() => { this.speak(activeConfig.firstMessage); }, 500);
    return true; 
  }

  forceSubmit() {
      if (this.currentTranscript.length < 1) return;
      if (this.isAgentSpeaking) return;

      console.log("Time's up. Sending:", this.currentTranscript);
      this.onStatusUpdate("Silence detected. Sending...");
      
      const textToSend = this.currentTranscript;
      this.currentTranscript = ""; // Clear buffer
      
      // Stop mic to process
      this.stopMic(); 
      this.handleFinalSpeech(textToSend);
  }

  async handleFinalSpeech(text: string) {
      this.isAgentSpeaking = true; 
      this.onStatusUpdate("Thinking...");
      
      try {
        const responseText = await this.askGoogleWithHistory(text);
        if (responseText) this.speak(responseText);
      } catch (error) {
        this.isAgentSpeaking = false;
        this.startMic();
      }
  }

  startMic() {
    if (!this.recognition || this.isAgentSpeaking) return;
    try { this.recognition.start(); this.onStatusUpdate("Listening..."); } catch (e) {}
  }

  stopMic() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (!this.recognition) return;
    try { this.recognition.stop(); } catch (e) {}
  }

  async askGoogleWithHistory(userText: string) {
    if (!this.modelUrl) return "Connection error.";
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
    this.synth.cancel();
    this.onStatusUpdate("Speaking...");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; 
    
    utterance.onend = () => {
        this.isAgentSpeaking = false;
        this.currentTranscript = ""; 
        this.onStatusUpdate("Done. Listening...");
        setTimeout(() => { if (this.isListening) this.startMic(); }, 500); 
    };

    this.synth.speak(utterance);
  }

  async stop() {
    this.isListening = false;
    this.isAgentSpeaking = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
    this.onStatusUpdate("Stopped.");
  }
}
