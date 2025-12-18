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
  
  // VAD VARIABLES
  private checkInterval: any = null;
  private lastSpeechTime: number = 0;
  private currentTranscript: string = ""; // Holds the words BEFORE they are final

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
      
      // START THE VOLUME MONITOR
      this.startVolumeMonitor(analyser);

    } catch (e) { this.onStatusUpdate("Error: Mic Blocked"); }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; 
    this.recognition.interimResults = true; // IMPORTANT: We catch words immediately
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        
        // Save the text to our variable
        if (text && text.trim().length > 0) {
            this.currentTranscript = text;
            this.lastSpeechTime = Date.now(); // Reset silence timer because we heard words
            this.onStatusUpdate(`Hearing: "${text.substring(0, 20)}..."`);
        }
    };

    // Auto-restart if it dies unexpectedly
    this.recognition.onend = () => {
        if (this.isListening && !this.isAgentSpeaking) {
            try { this.recognition.start(); } catch (e) {} 
        }
    };

    this.startMic();
    setTimeout(() => { this.speak(activeConfig.firstMessage); }, 500);
    return true; 
  }

  // --- THE "MANUAL OVERRIDE" ENGINE ---
  startVolumeMonitor(analyser: AnalyserNode) {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      if (this.checkInterval) clearInterval(this.checkInterval);

      this.checkInterval = setInterval(() => {
          if (!this.isListening || this.isAgentSpeaking) return;

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
          const average = sum / bufferLength;

          // 1. IF VOLUME IS HIGH -> We are definitely talking
          if (average > 10) {
              this.lastSpeechTime = Date.now();
          } 
          
          // 2. CHECK FOR SILENCE
          // If we have text waiting AND it has been silent for 1.2 seconds...
          const timeSinceSpeech = Date.now() - this.lastSpeechTime;
          
          if (this.currentTranscript.length > 0 && timeSinceSpeech > 1200) {
              
              console.log("Silence detected. Forcing Submit:", this.currentTranscript);
              this.onStatusUpdate("Silence detected. Sending...");
              
              // FORCE SEND
              const textToSend = this.currentTranscript;
              this.currentTranscript = ""; // Clear it so we don't send twice
              
              this.handleFinalSpeech(textToSend);
          }

      }, 100);
  }

  async handleFinalSpeech(text: string) {
      if (!text || text.trim().length < 1) return;
      
      // Stop the mic so we don't hear ourselves
      this.isAgentSpeaking = true; 
      this.recognition.stop(); 

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
        this.currentTranscript = ""; // Clear buffer
        this.onStatusUpdate("Done. Listening...");
        setTimeout(() => { if (this.isListening) this.startMic(); }, 500); 
    };

    this.synth.speak(utterance);
  }

  async stop() {
    this.isListening = false;
    this.isAgentSpeaking = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
    this.onStatusUpdate("Stopped.");
  }
}
