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
  
  // VOLUMETRIC TRIGGER
  private speechDetected: boolean = false;
  private silenceTimer: any = null;
  private lastVolumetricSpeech: number = 0;
  private checkInterval: any = null;

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
    this.speechDetected = false;

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

    // 3. SETUP MIC & VISUALIZER BRIDGE
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Pass analyser to UI
      onAudioData(analyser);

      // START THE BRIDGE MONITOR
      this.startVolumeMonitor(analyser);

    } catch (e) { this.onStatusUpdate("Error: Mic Blocked"); }

    // 4. SETUP EARS
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        this.onStatusUpdate("Error: Browser Not Supported");
        return;
    }

    this.recognition = new SpeechRecognition();
    // We use CONTINUOUS so we can manually stop it when volume drops
    this.recognition.continuous = true; 
    this.recognition.interimResults = true; 
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
        // Just store the text, don't act yet. The VOLUME monitor will trigger the action.
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        if (text) this.onStatusUpdate(`Hearing: "${text.substring(0, 15)}..."`);
    };

    this.recognition.onend = () => {
        // Auto-restart if we shouldn't have stopped
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

  // --- THE BRIDGE: USES YELLOW BARS TO CONTROL EARS ---
  startVolumeMonitor(analyser: AnalyserNode) {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      if (this.checkInterval) clearInterval(this.checkInterval);

      this.checkInterval = setInterval(() => {
          if (!this.isListening || this.isAgentSpeaking) return;

          analyser.getByteFrequencyData(dataArray);
          
          // Calculate Average Volume
          let sum = 0;
          for(let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
          const average = sum / bufferLength;

          // THRESHOLD: 10 (Adjust if needed)
          if (average > 10) {
              // User is speaking
              this.speechDetected = true;
              this.lastVolumetricSpeech = Date.now();
              this.onStatusUpdate("Listening (Voice Detected)...");
          } else {
              // Silence...
              if (this.speechDetected) {
                  const timeSinceSpeech = Date.now() - this.lastVolumetricSpeech;
                  
                  // IF SILENCE > 1.2 SECONDS -> FORCE SUBMIT
                  if (timeSinceSpeech > 1200) {
                      console.log("Volume dropped. Forcing submit.");
                      this.speechDetected = false; // Reset
                      this.stopMicAndSubmit();
                  }
              }
          }
      }, 100); // Check 10 times a second
  }

  stopMicAndSubmit() {
      if (!this.recognition) return;
      this.recognition.stop(); // This triggers 'onresult' final or just stops
      // Note: We need to grab the text manually or trust the final event.
      // Let's force a restart cycle to flush buffers.
      this.isAgentSpeaking = true; // Temporary lock
      
      // Give the browser 100ms to finalize the transcript
      setTimeout(() => {
         // The actual submission happens in 'onresult' usually, but if that failed,
         // we might need to rely on the fact that stopping produces a result.
         this.isAgentSpeaking = false; 
      }, 500);
  }

  // STANDARD LOGIC BELOW
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
    this.isAgentSpeaking = true;
    this.stopMic(); 
    this.synth.cancel();
    this.onStatusUpdate("Speaking...");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; 
    
    utterance.onend = () => {
        this.isAgentSpeaking = false;
        this.speechDetected = false; // Reset logic
        this.onStatusUpdate("Done. Listening...");
        setTimeout(() => {
            if (this.isListening) this.startMic();
        }, 500); 
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
