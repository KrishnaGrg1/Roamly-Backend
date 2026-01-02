export interface SendMessagePayload {
  receiverId: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  receiverId: string;
  senderId: string;
  message: string;
  timestamp: Date;
}

export interface SocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
