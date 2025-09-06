export interface Env {
  AI: any;
  IMAGE_STORE: KVNamespace;
  ENVIRONMENT: string;
}

export interface GenerateRequest {
  prompt: string;
  steps?: number;
}

export interface GenerateResponse {
  success: boolean;
  image?: string;
  timestamp?: number;
  prompt?: string;
  steps?: number;
  error?: string;
  details?: string;
}

export interface HistoryItem {
  prompt: string;
  steps: number;
  timestamp: number;
  imageData: string;
}
