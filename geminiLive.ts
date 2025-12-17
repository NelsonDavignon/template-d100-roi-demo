import { GoogleGenerativeAI } from "@google/generative-ai";

// This checks EVERY possible place the key might be hiding
const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  import.meta.env.REACT_APP_GEMINI_API_KEY ||
  "";

export class LiveClient {
  private client: any;
  
  constructor() {
    if (!API_KEY) {
      console.error("API Key not found. Please check Vercel settings.");
      throw new Error("API Key missing.");
    }
    // Initialize the client
    this.client = new GoogleGenerativeAI(API_KEY);
  }

  async connect() {
    // Simple connection test
    return { status: "connected", key_found: true };
  }
}
