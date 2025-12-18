import { activeConfig } from "../config";

const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  "";

export class GeminiLiveService {
  private synth: SpeechSynthesis;
  private recognition: any;
  private modelUrl: string = ""; 
  private voices: SpeechSynthesisVoice[] = [];
  private history: { role: string; parts: { text: string }[] }[] = [];
  
  private isListening: boolean = false; 
  private isAgentSpeaking: boolean = false;
  private isMobile: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
    
    // DETECT MOBILE ON LOAD
    if (typeof window !== 'undefined') {
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        const loadVoices = () => { 
            this.voices = this.synth.getVoices(); 
        };
        this.synth.onvoiceschanged = loadVoices;
        loadVoices(); 
        setTimeout(loadVoices, 1000);
    }
  }

  async findWorkingModel() {
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
    } catch (e) { console.error(e); }
    return false;
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    this.isListening = true;

    // 1. WAKE UP AUDIO (Safe for both)
    const utterance = new SpeechSynthesisUtterance(" ");
    this.synth.speak(utterance);
    this.synth.cancel();

    await this.findWorkingModel();

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
    } catch (e) { console.error("Mic Error", e); }

    // 4. SETUP EARS
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    
    // --- THE SPLIT BRAIN LOGIC ---
    if (this.isMobile) {
        // IPHONE: Single Shot Mode (Must stop/start or it crashes)
        this.recognition.continuous = false;
    } else {
        // MAC/PC: Continuous Mode (Must NEVER stop or it breaks)
        this.recognition.continuous = true;
    }
    
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      // LOGIC GATE: If Sarah is talking, ignore the user
      // On Mac, the mic is still open, but we just throw the text in the trash here.
      if (this.isAgentSpeaking) {
          console.log("Ignored input while agent speaking");
          return;
      }

      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      if (!text || text.trim().length < 1) return;

      console.log("User said:", text);
      
      // IPHONE ONLY: Stop mic to think.
      // MAC: Keep mic open (do nothing).
      if (this.isMobile) this.stopMic(); 

      try {
        const responseText = await this.askGoogleWithHistory(text);
        if (responseText) this.speak(responseText);
      } catch (error) {
        if (this.isMobile) this.startMic();
      }
    };

    // RESTART LOGIC
    this.recognition.onend = () => {
        // If we are supposed to be listening...
        if (this.isListening) {
            // On iPhone: Restart always (because it stopped to think)
            // On Mac: Restart only if it crashed (because it should be continuous)
            if (this.isMobile && !this.isAgentSpeaking) {
                 try { this.recognition.start(); } catch (e) {} 
            } else if (!this.isMobile) {
                 // Mac crash recovery
                 try { this.recognition.start(); } catch (e) {}
            }
        }
    };

    // START
    this.startMic();

    setTimeout(() => {
        this.speak(activeConfig.firstMessage);
    }, 500);
    
    return true; 
  }

  startMic() {
    if (!this.recognition) return;
    try { this.recognition.start(); } catch (e) {}
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
    
    // IPHONE ONLY: Kill the ears so no echo
    // MAC: Leave ears open, but software will ignore input (see onresult)
    if (this.isMobile) this.stopMic(); 
    
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (this.voices.length > 0) {
        const targetGender = (activeConfig as any).voiceGender || 'female';
        let bestVoice;

        if (targetGender === 'male') {
            bestVoice = 
                this.voices.find(v => v.name.includes("Daniel")) || 
                this.voices.find(v => v.name.includes("Male") && v.name.includes("English")) ||
                this.voices.find(v => v.name.includes("David"));   
        } else {
            bestVoice = 
                this.voices.find(v => v.name.includes("Samantha")) || 
                this.voices.find(v => v.name.includes("Google US English")) || 
                this.voices.find(v => v.name.includes("Natural") && !v.name.includes("Male"));
        }
        
        // Final fallback
        if (!bestVoice) {
             if (targetGender === 'male') bestVoice = this.voices.find(v => v.name.includes("Male"));
             else bestVoice = this.voices.find(v => v.name.includes("Female"));
        }
        
        if (bestVoice) utterance.voice = bestVoice;
    }
    
    // Slower is less robotic
    utterance.rate = 0.9; 
    
    utterance.onend = () => {
        this.isAgentSpeaking = false;
        
        // IPHONE ONLY: Turn ears back on
        if (this.isMobile && this.isListening) {
            setTimeout(() => { this.startMic(); }, 200);
        }
    };

    this.synth.speak(utterance);
  }

  async stop() {
    this.isListening = false;
    this.isAgentSpeaking = false;
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
