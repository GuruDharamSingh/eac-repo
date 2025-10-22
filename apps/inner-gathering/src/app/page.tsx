"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Container,
  Stack,
  Anchor,
  Center,
  Box,
  Alert,
} from "@mantine/core";
import { Sparkles, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        // Sign up new user using direct auth client
        const { user, error: signUpError } = await authClient.signUp(
          email,
          password,
          { display_name: displayName || email.split("@")[0] }
        );

        if (signUpError) throw new Error(signUpError);

        if (user) {
          // Successfully signed up, redirect to feed
          router.push("/feed");
          router.refresh();
        }
      } else {
        // Sign in existing user
        const { user, error: signInError } = await authClient.signIn(email, password);

        if (signInError) throw new Error(signInError);

        if (user) {
          // Successfully signed in, redirect to feed
          router.push("/feed");
          router.refresh();
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container size={420} px="md">
        <Stack gap="lg">
          <Center>
            <Stack gap="xs" align="center">
              <Sparkles size={48} color="white" strokeWidth={1.5} />
              <Title
                order={1}
                c="white"
                style={{
                  fontSize: "2rem",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                InnerGathering
              </Title>
              <Text c="white" size="sm" opacity={0.9}>
                Connect, Share, Grow Together
              </Text>
            </Stack>
          </Center>

          <Paper radius="lg" p="xl" withBorder shadow="md">
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <Title order={2} size="h3" ta="center">
                  {mode === "login" ? "Welcome Back" : "Join Us"}
                </Title>

                {error && (
                  <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                    {error}
                  </Alert>
                )}

                {mode === "signup" && (
                  <TextInput
                    label="Display Name"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.currentTarget.value)}
                    size="md"
                  />
                )}

                <TextInput
                  required
                  label="Email"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  size="md"
                />

                <PasswordInput
                  required
                  label="Password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  size="md"
                  minLength={6}
                />

                <Button type="submit" fullWidth size="md" loading={loading}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                </Button>

                <Text ta="center" size="sm">
                  {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                  <Anchor
                    component="button"
                    type="button"
                    onClick={() => {
                      setMode(mode === "login" ? "signup" : "login");
                      setError(null);
                    }}
                    fw={500}
                  >
                    {mode === "login" ? "Sign up" : "Sign in"}
                  </Anchor>
                </Text>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
