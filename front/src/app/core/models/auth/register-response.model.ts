export interface RegisterResponse {
  success: boolean;
  requiresVerification: boolean;
  email: string;
  message: string;
}
