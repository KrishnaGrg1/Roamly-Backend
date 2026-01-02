export const SOCKET_EVENTS = {
  // Incoming events
  SEND_MESSAGE: 'sendMessage',

  // Outgoing events
  MESSAGE: 'message',
  MESSAGE_SENT: 'messageSent',
  ERROR: 'error',
} as const;

export const ERROR_MESSAGES = {
  INVALID_PAYLOAD: 'Invalid payload format',
  MISSING_RECEIVER_ID: 'Receiver ID is required',
  MISSING_MESSAGE: 'Message content is required',
  NOT_AUTHENTICATED: 'User not authenticated',
  PARSE_ERROR: 'Failed to parse message payload',
} as const;
