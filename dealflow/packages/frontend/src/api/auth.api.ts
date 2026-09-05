import axios, { AxiosInstance, AxiosError } from "axios";
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  AuthResponse,
  AuthTokens,
  PublicUser,
  ApiSuccess,
  ApiError,
} from "@auth-module/core";

// ---------------------------------------------------------------------------
// AuthApiClient — thin wrapper over Axios.
// All methods return typed domain objects or throw a structured error.
// The access token is injected per-request; the refresh token lives in an
// httpOnly cookie managed by the browser.
// ---------------------------------------------------------------------------

export class AuthApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

function unwrap<T>(data: ApiSuccess<T> | ApiError): T {
  if (!data.success) {
    throw new AuthApiError((data as ApiError).code, data.message, 0);
  }
  return (data as ApiSuccess<T>).data;
}

export class AuthApiClient {
  private readonly http: AxiosInstance;

  constructor(baseURL: string, private getAccessToken?: () => string | null) {
    this.http = axios.create({
      baseURL: `${baseURL}/auth`,
      withCredentials: true, // sends httpOnly refresh cookie
      headers: { "Content-Type": "application/json" },
    });

    // Attach access token from in-memory store
    this.http.interceptors.request.use((config) => {
      const token = this.getAccessToken?.();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    });

    // Normalize errors
    this.http.interceptors.response.use(
      (res) => res,
      (err: AxiosError<ApiError>) => {
        const data = err.response?.data;
        const status = err.response?.status ?? 0;
        if (data && !data.success) {
          throw new AuthApiError(data.code, data.message, status);
        }
        throw new AuthApiError("NETWORK_ERROR", err.message ?? "Network error", status);
      },
    );
  }

  // ── Registration ──────────────────────────────────────────────────────────

  async register(input: RegisterInput): Promise<{ maskedIdentifier: string }> {
    const res = await this.http.post<ApiSuccess<{ maskedIdentifier: string }>>("/register", input);
    return unwrap(res.data);
  }

  async verifyRegistration(identifier: string, otp: string): Promise<AuthResponse> {
    const res = await this.http.post<ApiSuccess<{ user: PublicUser; accessToken: string; expiresIn: number }>>(
      "/verify-registration",
      { identifier, otp, purpose: "REGISTRATION" },
    );
    const data = unwrap(res.data);
    return {
      user: data.user,
      tokens: { accessToken: data.accessToken, refreshToken: "", expiresIn: data.expiresIn },
    };
  }

  async resendRegistrationOtp(identifier: string): Promise<{ maskedIdentifier: string }> {
    const res = await this.http.post<ApiSuccess<{ maskedIdentifier: string }>>(
      "/resend-registration-otp",
      { identifier, purpose: "REGISTRATION" },
    );
    return unwrap(res.data);
  }

  // ── Login / Logout ────────────────────────────────────────────────────────

  async login(input: LoginInput): Promise<AuthResponse> {
    const res = await this.http.post<ApiSuccess<{ user: PublicUser; accessToken: string; expiresIn: number }>>(
      "/login",
      input,
    );
    const data = unwrap(res.data);
    return {
      user: data.user,
      tokens: { accessToken: data.accessToken, refreshToken: "", expiresIn: data.expiresIn },
    };
  }

  async logout(): Promise<void> {
    await this.http.post("/logout");
  }

  // ── Token refresh ─────────────────────────────────────────────────────────

  async refresh(): Promise<AuthTokens> {
    const res = await this.http.post<ApiSuccess<{ accessToken: string; expiresIn: number }>>("/refresh");
    const data = unwrap(res.data);
    return { accessToken: data.accessToken, refreshToken: "", expiresIn: data.expiresIn };
  }

  // ── Forgot / Reset password ───────────────────────────────────────────────

  async forgotPassword(input: ForgotPasswordInput): Promise<{ maskedIdentifier: string }> {
    const res = await this.http.post<ApiSuccess<{ maskedIdentifier: string }>>("/forgot-password", input);
    return unwrap(res.data);
  }

  async verifyResetOtp(identifier: string, otp: string): Promise<{ resetToken: string }> {
    const res = await this.http.post<ApiSuccess<{ resetToken: string }>>(
      "/verify-reset-otp",
      { identifier, otp, purpose: "PASSWORD_RESET" },
    );
    return unwrap(res.data);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await this.http.post("/reset-password", input);
  }

  // ── Current user ──────────────────────────────────────────────────────────

  async getMe(): Promise<PublicUser> {
    const res = await this.http.get<ApiSuccess<{ user: PublicUser }>>("/me");
    return unwrap(res.data).user;
  }
}
