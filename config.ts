// src/config.ts

// --- CHANGE THIS TO SWITCH NICHES ---
// Options: "renovation" | "dentist" | "coach"
export const CURRENT_NICHE = "renovation"; 

export const NICHES = {
  renovation: {
    title: "Meet Your New Home Coordinator",
    subtitle: "She never sleeps, never misses a call, and books appointments instantly.",
    agentName: "Sarah",
    primaryColor: "text-yellow-500", // Gold color
    systemPrompt: "You are Sarah, a warm and professional home renovation expert for Kerr Design Build. Your goal is to book an appointment. Keep answers extremely short (1 sentence max).",
    firstMessage: "Hi! I'm Sarah. How can I help with your renovation project?"
  },
  dentist: {
    title: "24/7 Dental Booking Assistant",
    subtitle: "Book your cleaning or emergency exam without waiting on hold.",
    agentName: "Jessica",
    primaryColor: "text-blue-500", // Blue color
    systemPrompt: "You are Jessica, a friendly receptionist for Bright Smile Dental. Your goal is to schedule a check-up. Be soothing and brief (1 sentence max).",
    firstMessage: "Hello! This is Bright Smile Dental. Are you calling for a check-up or an emergency?"
  },
  coach: {
    title: "High-Performance Life Coach AI",
    subtitle: "Get immediate feedback and book your strategy session.",
    agentName: "Alex",
    primaryColor: "text-green-500", // Green color
    systemPrompt: "You are Alex, a high-performance life coach. You are energetic, direct, and motivating. Your goal is to get the user to book a strategy call. Keep it punchy.",
    firstMessage: "Hey there! Ready to crush your goals? What's on your mind today?"
  }
};

export const activeConfig = NICHES[CURRENT_NICHE as keyof typeof NICHES];
