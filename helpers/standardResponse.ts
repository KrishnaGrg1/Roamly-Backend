export function makeSuccessResponse(
  data: any,
  message: string,
  statusCode = 200,
  headers?: Record<string, string>
) {
  return {
    statusCode,
    headers,
    body: {
      message: message,
      data,
    },
  };
}

export function makeErrorResponse(
  error: Error,
  message: string,
  statusCode = 500,
  headers?: Record<string, string>
) {
  return {
    statusCode,
    headers,
    body: {
      message: message,
      error: error.message,
    },
  };
}
