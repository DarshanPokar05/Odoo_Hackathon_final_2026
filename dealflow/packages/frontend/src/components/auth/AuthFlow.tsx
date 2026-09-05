import React, { useState } from "react";
import { useAuthConfig } from "../../context/AuthContext";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { OtpVerification } from "./OtpVerification";
import { ForgotPassword } from "./ForgotPassword";
import { ResetPassword } from "./ResetPassword";
import { injectThemeCssVars } from "../../utils/styles";
import { AuthTheme } from "../../types/auth-ui.types";

type FlowStep =
  | "login"
  | "register"
  | "registration-otp"
  | "forgot-password"
  | "reset-otp"
  | "reset-password"
  | "done";

interface OtpState {
  identifier: string;
  maskedIdentifier: string;
  verifiedOtp: string;
}

interface AuthFlowProps {
  initialStep?: "login" | "register";
  onAuthenticated?: () => void;
  onPasswordResetSuccess?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function AuthFlow({
  initialStep = "login",
  onAuthenticated,
  onPasswordResetSuccess,
  className,
  style,
}: AuthFlowProps) {
  const { config } = useAuthConfig();
  const [step, setStep] = useState<FlowStep>(initialStep);
  const [otpState, setOtpState] = useState<OtpState>({
    identifier: "",
    maskedIdentifier: "",
    verifiedOtp: "",
  });

  const wrapperStyle: React.CSSProperties = {
    ...injectThemeCssVars(config.theme as AuthTheme),
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--auth-bg, #f9fafb)",
    padding: "16px",
    boxSizing: "border-box",
    ...style,
  };

  return (
    <div className={className} style={wrapperStyle}>
      {step === "login" && (
        <LoginForm
          onSuccess={onAuthenticated}
          onForgotPassword={() => setStep("forgot-password")}
          onRegister={() => setStep("register")}
        />
      )}

      {step === "register" && (
        <RegisterForm
          onLoginClick={() => setStep("login")}
          onOtpRequired={(masked, identifier) => {
            setOtpState({ identifier, maskedIdentifier: masked, verifiedOtp: "" });
            setStep("registration-otp");
          }}
        />
      )}

      {step === "registration-otp" && (
        <OtpVerification
          identifier={otpState.identifier}
          maskedIdentifier={otpState.maskedIdentifier}
          purpose="REGISTRATION"
          onSuccess={onAuthenticated}
          onBack={() => setStep("register")}
        />
      )}

      {step === "forgot-password" && (
        <ForgotPassword
          onBack={() => setStep("login")}
          onOtpSent={(masked, identifier) => {
            setOtpState({ identifier, maskedIdentifier: masked, verifiedOtp: "" });
            setStep("reset-otp");
          }}
        />
      )}

      {step === "reset-otp" && (
        <OtpVerification
          identifier={otpState.identifier}
          maskedIdentifier={otpState.maskedIdentifier}
          purpose="PASSWORD_RESET"
          onSuccess={(verifiedOtp) => {
            // Capture the verified OTP so ResetPassword can submit it with the new password
            setOtpState((prev) => ({ ...prev, verifiedOtp: verifiedOtp ?? "" }));
            setStep("reset-password");
          }}
          onBack={() => setStep("forgot-password")}
        />
      )}

      {step === "reset-password" && (
        <ResetPassword
          identifier={otpState.identifier}
          otp={otpState.verifiedOtp}
          onSuccess={() => {
            onPasswordResetSuccess?.();
            setStep("login");
          }}
          onBack={() => setStep("reset-otp")}
        />
      )}
    </div>
  );
}
