// MASTER KEY MODE: Auto-detects the correct model for your account.

// PASTE YOUR TIER 1 KEY HERE
const API_KEY = "AIzaSyBDZDS3qHCuJ_7PF8Kr9ro1EY0ZAuayekg";

export class GeminiLiveService {
  private synth: SpeechSynthesis;
  private recognition: any;
  private modelUrl: string = ""; // We will find this automatically

  constructor() {
    this.synth = window.speechSynthesis;
    if (API_KEY.includes("PASTE_YOUR")) {
       alert("CRITICAL: You forgot to paste the API Key!");
    }
  }

  // --- THE MASTER KEY LOGIC ---
  // This asks Google which model works for YOU.
  async findWorkingModel() {
    try {
        console.log("Searching for available brains...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.models) throw new Error("No models found for this key.");

        // Find the best model that supports generating content
        const validModel = data.models.find((m: any) => 
            m.name.includes("gemini") && 
            m.supportedGenerationMethods.includes("generateContent")
        );

        if (validModel) {
            console.log("FOUND WORKING BRAIN:", validModel.name);
            // Build the URL for this specific brain
            this.modelUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${API_KEY}`;
            return true;
        } else {
            throw new Error("No chat models available.");
        }
    } catch (e: any) {
        console.error(e);
        alert("ACCOUNT ERROR: " + e.message);
        return false;
    }
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // 1. Find the Brain first
    const brainReady = await this.findWorkingModel();
    if (!brainReady) return;

    // 2. Setup Mic
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

    // 3. Setup Ears
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

      // 4. SEND TO THE AUTO-DETECTED BRAIN
      try {
        const responseText = await this.askGoogleDirectly(text);
        this.speak(responseText);
      } catch (error: any) {
        console.error("API Error:", error);
        alert("ERROR: " + error.message);
      }
    };

    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("System Online. Connected to Google.");
    return true; 
  }

  async askGoogleDirectly(userText: string) {
    if (!this.modelUrl) throw new Error("Brain not connected.");

    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: "You are Sarah. Be brief. User says: " + userText }] 
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Unknown API Error");
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        return "I am listening.";
    }
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
