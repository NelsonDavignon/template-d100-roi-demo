export interface ClientConfig {
  name: string;
  website: string;
  industry: string;
  themeColor: string;
  metrics: {
    avgJobValue: number;
    defaultLeads: number;
    defaultMissedRate: number;
    defaultCloseRate: number;
  };
  agent: {
    name: string;
    voiceName: string;
    systemInstruction: string;
  };
}

export interface SlideProps {
  isActive: boolean;
  config: ClientConfig;
}

export enum SlideIndex {
  PROBLEM = 0,
  SOLUTION = 1,
  ROI = 2,
  POSSIBILITIES = 3,
  OFFER = 4,
}