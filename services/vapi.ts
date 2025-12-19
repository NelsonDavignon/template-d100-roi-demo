import Vapi from "@vapi-ai/web";
import { activeConfig } from "../config";

// --- PASTE YOUR VAPI PUBLIC KEY HERE ---
const VAPI_PUBLIC_KEY = "YOUR_PUBLIC_KEY_HERE"; 

export class VapiService {
  private vapi: any;
  private onStatusUpdate: (msg: string) => void = () => {};

  constructor() {
    this.vapi = new Vapi(VAPI_PUBLIC_KEY);
  }

  setStatusListener(callback: (msg: string) => void) {
    this.onStatusUpdate = callback;
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // 1. INSTANT FEEDBACK: Don't wait for connection. Lie to the user.
    // This makes it feel snappy immediately.
    this.onStatusUpdate("Call Active");

    try {
      const assistantOptions = {
        name: activeConfig.agentName,
        firstMessage: activeConfig.firstMessage,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en-US",
        },
        voice: {
          provider: "11labs",
          voiceId: activeConfig.voiceGender === 'male' 
            ? "burt" 
            : "sarah",
        },
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: activeConfig.systemPrompt
            }
          ]
        }
      };

      // 2. Start the Call
      await this.vapi.start(assistantOptions);

      // 3. Listen for Events
      this.vapi.on("call-start", () => this.onStatusUpdate("Call Active"));
      
      this.vapi.on("speech-start", () => this.onStatusUpdate("Listening..."));
      
      this.vapi.on("speech-end", () => this.onStatusUpdate("Thinking..."));
      
      this.vapi.on("message", (message: any) => {
         if (message.type === "conversation-update" && message.conversation.length > 0) {
             const lastMsg = message.conversation[message.conversation.length - 1];
             if (lastMsg.role === "assistant") {
                 this.onStatusUpdate("Speaking...");
             }
         }
      });

      this.vapi.on("error", (e: any) => {
        console.error(e);
        // Only show error if it's a real crash, otherwise ignore small network blips
        if (e.error?.message) this.onStatusUpdate("Error: " + e.error.message);
      });

      this.vapi.on("call-end", () => {
        this.onStatusUpdate("Call Ended");
      });

      // 4. Setup Visualizer
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          onAudioData(analyser);
      } catch (e) {
          console.error("Mic visualizer failed");
      }

    } catch (e) {
      console.error(e);
      this.onStatusUpdate("Connection Failed");
    }
  }

  stop() {
    this.vapi.stop();
    this.onStatusUpdate("Call Ended");
  }
}
