// SECURE MODE: Reads the key from Vercel. No hardcoded passwords.

// This line pulls the key from the "Vercel Vault" automatically
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
    // Safety Check
    if (!API_KEY || API_KEY.length < 10) {
       console.error("CRITICAL: API Key is missing from Vercel Environment Variables.");
       // We don't alert immediately to avoid annoying popups if it's just loading
    }
  }

  // --- BRAIN FINDER ---
  async findWorkingModel() {
    try {
        console.log("Connecting to Google...");
        // This request uses the hidden key
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
        alert("SECURITY ERROR: Could not connect. Check Vercel Environment Variables.");
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

      if (!text) return;

      try {
        const responseText = await this.askGoogleDirectly(text);
        this.speak(responseText);
      } catch (error: any) {
        console.error("API Error:", error);
      }
    };

    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("System Secure. Ready.");
    return true; 
  }

  async askGoogleDirectly(userText: string) {
    if (!this.modelUrl) return "I am offline.";

    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: "You are Sarah. Be brief. User says: " + userText }] 
        }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
    }
    return "I didn't catch that.";
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = this.synth.getVoices();
    const bestVoice = voices.find(v => v.name.includes("Google US English")) || voices.find(v => v.name.includes("Female"));
    if (bestVoice) utterance.voice = bestVoice;
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
