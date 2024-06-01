export interface ApiResponse {
  statusCode: number;
  body: string;
}

export interface ErrorResponse extends ApiResponse {
  error: string;
}
