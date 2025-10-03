"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";

const createInitialState = () => ({
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
});

type AuthMode = "signIn" | "signUp";

type AuthFormState = ReturnType<typeof createInitialState>;

export function AuthHeaderForm() {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [formData, setFormData] = useState<AuthFormState>(() => createInitialState());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "signUp";

  const isFormValid = useMemo(() => {
    if (!formData.email.trim() || !formData.password.trim()) {
      return false;
    }

    if (isSignUp) {
      if (!formData.name.trim()) return false;
      if (!formData.confirmPassword.trim()) return false;
      if (formData.password !== formData.confirmPassword) return false;
    }

    return true;
  }, [formData, isSignUp]);

  const handleInputChange = (
    field: keyof AuthFormState,
    value: string,
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      if (isSignUp && formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await new Promise(resolve => setTimeout(resolve, 600));

      setFeedback(
        isSignUp
          ? "Account created. You can sign in once auth is connected."
          : "Signed in (demo only).",
      );

      setFormData(createInitialState());
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to process the request right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <SegmentedControl
          value={mode}
          onChange={value => {
            setMode(value as AuthMode);
            setError(null);
            setFeedback(null);
          }}
          data={[
            { label: "Sign in", value: "signIn" },
            { label: "Sign up", value: "signUp" },
          ]}
          size="xs"
        />
        <Text size="xs" c="dimmed">
          {isSignUp
            ? "Create an account to manage meetings for your organization."
            : "Access your meetings and RSVPs."}
        </Text>
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            {isSignUp ? (
              <TextInput
                label="Full name"
                placeholder="Jane Doe"
                value={formData.name}
                onChange={event => handleInputChange("name", event.currentTarget.value)}
                required
              />
            ) : null}

            <TextInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={event => handleInputChange("email", event.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Password"
              placeholder="********"
              value={formData.password}
              onChange={event => handleInputChange("password", event.currentTarget.value)}
              required
            />

            {isSignUp ? (
              <PasswordInput
                label="Confirm password"
                placeholder="********"
                value={formData.confirmPassword}
                onChange={event =>
                  handleInputChange("confirmPassword", event.currentTarget.value)
                }
                required
              />
            ) : null}

            {error ? (
              <Text size="xs" c="red">
                {error}
              </Text>
            ) : null}
            {feedback ? (
              <Text size="xs" c="green">
                {feedback}
              </Text>
            ) : null}

            <Button type="submit" disabled={!isFormValid || isSubmitting} loading={isSubmitting}>
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
