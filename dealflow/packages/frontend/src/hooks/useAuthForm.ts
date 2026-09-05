import { useState, useCallback } from "react";
import { AuthApiError } from "../api/auth.api";

// ---------------------------------------------------------------------------
// useAuthForm — generic form state manager for auth forms.
// Handles loading, error, and field-level validation state.
// ---------------------------------------------------------------------------

export interface AuthFormState<T extends Record<string, string>> {
  values: T;
  errors: Partial<T>;
  globalError: string | null;
  isLoading: boolean;
  isSuccess: boolean;
}

export function useAuthForm<T extends Record<string, string>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<T>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name as keyof T];
      return next;
    });
    setGlobalError(null);
  }, []);

  const setFieldError = useCallback((field: keyof T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setGlobalError(null);
  }, []);

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => Promise<void>) =>
      async (e: React.FormEvent) => {
        e.preventDefault();
        clearErrors();
        setIsLoading(true);
        setIsSuccess(false);
        try {
          await onSubmit(values);
          setIsSuccess(true);
        } catch (err) {
          if (err instanceof AuthApiError) {
            setGlobalError(err.message);
          } else if (err instanceof Error) {
            setGlobalError(err.message);
          } else {
            setGlobalError("An unexpected error occurred.");
          }
        } finally {
          setIsLoading(false);
        }
      },
    [values, clearErrors],
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setGlobalError(null);
    setIsLoading(false);
    setIsSuccess(false);
  }, [initialValues]);

  return {
    values,
    errors,
    globalError,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
    setFieldError,
    setGlobalError,
    clearErrors,
    reset,
    setValues,
  };
}
