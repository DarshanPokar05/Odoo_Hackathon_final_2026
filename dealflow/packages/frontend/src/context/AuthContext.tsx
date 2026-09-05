import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PublicUser } from "@auth-module/core";
import { AuthApiClient } from "../api/auth.api";
import { AuthContextValue, AuthState, AuthUIConfig, defaultLabels, defaultTheme } from "../types/auth-ui.types";

interface AuthConfigContextValue {
  config: Required<AuthUIConfig>;
  apiClient: AuthApiClient;
}

const AuthConfigContext = createContext<AuthConfigContextValue | null>(null);
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthConfig(): AuthConfigContextValue {
  const ctx = useContext(AuthConfigContext);
  if (!ctx) throw new Error("useAuthConfig must be used inside <AuthProvider>");
  return ctx;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

interface AuthProviderProps {
  config: AuthUIConfig;
  children: React.ReactNode;
}

const INITIAL_STATE: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
};

export function AuthProvider({ config, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  const resolvedConfig = useMemo<Required<AuthUIConfig>>(() => ({
    apiBaseUrl: config.apiBaseUrl,
    otpLength: config.otpLength ?? 6,
    logoUrl: config.logoUrl ?? "",
    appName: config.appName ?? "App",
    afterLoginPath: config.afterLoginPath ?? "/dashboard",
    afterLogoutPath: config.afterLogoutPath ?? "/login",
    showRememberMe: config.showRememberMe ?? true,
    enablePhone: config.enablePhone ?? false,
    enableEmail: config.enableEmail ?? true,
    cardClassName: config.cardClassName ?? "",
    theme: { ...defaultTheme, ...config.theme },
    labels: { ...defaultLabels, ...config.labels },
  }), [config]);

  const accessTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to always call the latest silentRefresh without stale closure
  const silentRefreshRef = useRef<() => Promise<void>>(async () => undefined);

  const apiClient = useMemo(
    () => new AuthApiClient(resolvedConfig.apiBaseUrl, () => accessTokenRef.current),
    [resolvedConfig.apiBaseUrl],
  );

  const clearAuthenticated = useCallback(() => {
    accessTokenRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, isInitialized: true });
  }, []);

  // scheduleRefresh uses the ref so it always calls the current silentRefresh
  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const refreshIn = Math.max((expiresIn - 60) * 1000, 10_000);
    refreshTimerRef.current = setTimeout(() => {
      void silentRefreshRef.current();
    }, refreshIn);
  }, []);

  const setAuthenticated = useCallback((user: PublicUser, accessToken: string, expiresIn: number) => {
    accessTokenRef.current = accessToken;
    setState({ user, accessToken, isAuthenticated: true, isLoading: false, isInitialized: true });
    scheduleRefresh(expiresIn);
  }, [scheduleRefresh]);

  const silentRefresh = useCallback(async () => {
    try {
      const tokens = await apiClient.refresh();
      accessTokenRef.current = tokens.accessToken;
      setState((s) => ({ ...s, accessToken: tokens.accessToken }));
      scheduleRefresh(tokens.expiresIn);
    } catch {
      clearAuthenticated();
    }
  }, [apiClient, scheduleRefresh, clearAuthenticated]);

  // Keep the ref up to date on every render
  silentRefreshRef.current = silentRefresh;

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const tokens = await apiClient.refresh();
        if (cancelled) return;
        const user = await apiClient.getMe();
        if (cancelled) return;
        setAuthenticated(user, tokens.accessToken, tokens.expiresIn);
      } catch {
        if (!cancelled) {
          setState({ ...INITIAL_STATE, isInitialized: true });
        }
      }
    };
    void init();
    return () => { cancelled = true; };
  }, [apiClient, setAuthenticated]);

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const login = useCallback(async (identifier: string, password: string, rememberMe = false) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await apiClient.login({ identifier, password, rememberMe });
      setAuthenticated(result.user, result.tokens.accessToken, result.tokens.expiresIn);
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, [apiClient, setAuthenticated]);

  const register = useCallback(async (
    name: string,
    email: string | undefined,
    phone: string | undefined,
    password: string,
    confirmPassword: string,
  ) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await apiClient.register({ name, email, phone, password, confirmPassword });
      setState((s) => ({ ...s, isLoading: false }));
      return result;
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, [apiClient]);

  const verifyRegistrationOtp = useCallback(async (identifier: string, otp: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await apiClient.verifyRegistration(identifier, otp);
      setAuthenticated(result.user, result.tokens.accessToken, result.tokens.expiresIn);
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, [apiClient, setAuthenticated]);

  const resendRegistrationOtp = useCallback(async (identifier: string) => {
    await apiClient.resendRegistrationOtp(identifier);
  }, [apiClient]);

  const logout = useCallback(async () => {
    try { await apiClient.logout(); } catch { /* ignore */ }
    clearAuthenticated();
  }, [apiClient, clearAuthenticated]);

  const refreshSession = useCallback(async () => {
    await silentRefresh();
  }, [silentRefresh]);

  const forgotPassword = useCallback(async (identifier: string) => {
    return apiClient.forgotPassword({ identifier });
  }, [apiClient]);

  const verifyResetOtp = useCallback(async (identifier: string, otp: string) => {
    return apiClient.verifyResetOtp(identifier, otp);
  }, [apiClient]);

  const resetPassword = useCallback(async (
    identifier: string,
    otp: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    await apiClient.resetPassword({ identifier, otp, newPassword, confirmPassword });
  }, [apiClient]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    login,
    register,
    verifyRegistrationOtp,
    resendRegistrationOtp,
    logout,
    refreshSession,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
  }), [state, login, register, verifyRegistrationOtp, resendRegistrationOtp, logout, refreshSession, forgotPassword, verifyResetOtp, resetPassword]);

  const configValue = useMemo(() => ({ config: resolvedConfig, apiClient }), [resolvedConfig, apiClient]);

  return (
    <AuthConfigContext.Provider value={configValue}>
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    </AuthConfigContext.Provider>
  );
}
