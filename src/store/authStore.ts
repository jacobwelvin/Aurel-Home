import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { API_BASE_URL } from "@/lib/api";
import { syncAuthCookie } from "@/lib/authCookie";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: "customer" | "admin";
  createdAt?: string;
}

interface AuthState {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    name: string
  ) => Promise<{
    success: boolean;
    needsEmailConfirmation?: boolean;
    email?: string;
    error?: string;
  }>;
  resendConfirmation: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  syncBackendProfile: (token: string, name?: string) => Promise<UserProfile | null>;
  refreshProfile: () => Promise<UserProfile | null>;
  setProfile: (profile: UserProfile) => void;
}

let authListenerRegistered = false;
let initPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      token: null,
      isLoading: false,
      isInitialized: false,
      isAuthenticated: false,
      isAdmin: false,

      initialize: async () => {
        if (initPromise) return initPromise;
        initPromise = (async () => {
          try {
            // 1. Purge any obsolete mock or malformed stored tokens from previous sessions
            if (typeof window !== "undefined") {
              try {
                const storedRaw = localStorage.getItem("aurel-auth-store");
                if (storedRaw) {
                  const parsed = JSON.parse(storedRaw);
                  const storedToken = parsed?.state?.token;
                  if (
                    storedToken &&
                    (typeof storedToken !== "string" ||
                      storedToken.startsWith("mock-") ||
                      storedToken === "mock-dev-token" ||
                      storedToken.length < 20)
                  ) {
                    localStorage.removeItem("aurel-auth-store");
                    syncAuthCookie(null);
                    set({
                      user: null,
                      profile: null,
                      token: null,
                      isAuthenticated: false,
                      isAdmin: false,
                    });
                  }
                }
              } catch {
                // Ignore parse errors
              }
            }

            if (!SUPABASE_ANON_KEY) {
              set({ isInitialized: true });
              return;
            }

            // 2. Query Supabase for active local session
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
              syncAuthCookie(null);
              try {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("aurel-auth-store");
                }
              } catch {}
              set({
                user: null,
                profile: null,
                token: null,
                isAuthenticated: false,
                isAdmin: false,
                isInitialized: true,
              });
              return;
            }

            // 3. Proactively refresh session if access token is expired or expiring in < 60s
            let activeSession = session;
            const now = Math.floor(Date.now() / 1000);
            if (activeSession.expires_at && activeSession.expires_at <= now + 60) {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              if (refreshError || !refreshData.session) {
                // Token cannot be refreshed — session is invalid
                await supabase.auth.signOut().catch(() => {});
                syncAuthCookie(null);
                try {
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("aurel-auth-store");
                  }
                } catch {}
                set({
                  user: null,
                  profile: null,
                  token: null,
                  isAuthenticated: false,
                  isAdmin: false,
                  isInitialized: true,
                });
                return;
              }
              activeSession = refreshData.session;
            }

            const token = activeSession.access_token;

            // 4. Authoritatively sync patron profile with backend PostgreSQL
            const profile = await get().syncBackendProfile(
              token,
              activeSession.user.user_metadata?.name || activeSession.user.user_metadata?.full_name
            );

            if (!profile) {
              // Backend rejected token with 401 or could not synchronize.
              // Cleanly default to guest session without entering zombie state.
              console.warn("Session could not be synchronized with backend. Resetting to guest.");
              syncAuthCookie(null);
              set({
                user: null,
                profile: null,
                token: null,
                isAuthenticated: false,
                isAdmin: false,
                isInitialized: true,
              });
              return;
            }

            syncAuthCookie(token);
            set({
              user: {
                id: activeSession.user.id,
                email: activeSession.user.email || "",
              },
              token,
              profile,
              isAuthenticated: true,
              isAdmin: profile.role === "admin",
              isInitialized: true,
            });

            // 5. Subscribe to token refresh / signout only once
            if (!authListenerRegistered) {
              authListenerRegistered = true;
              supabase.auth.onAuthStateChange(async (event, newSession) => {
                if (event === "SIGNED_OUT" || !newSession) {
                  syncAuthCookie(null);
                  try {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("aurel-auth-store");
                    }
                  } catch {}
                  set({
                    user: null,
                    profile: null,
                    token: null,
                    isAuthenticated: false,
                    isAdmin: false,
                  });
                } else if (newSession) {
                  const newToken = newSession.access_token;
                  const freshProfile = await get().syncBackendProfile(
                    newToken,
                    newSession.user.user_metadata?.name || newSession.user.user_metadata?.full_name
                  );

                  if (freshProfile) {
                    syncAuthCookie(newToken);
                    set({
                      user: { id: newSession.user.id, email: newSession.user.email || "" },
                      token: newToken,
                      profile: freshProfile,
                      isAuthenticated: true,
                      isAdmin: freshProfile.role === "admin",
                    });
                  } else {
                    syncAuthCookie(null);
                    set({
                      user: null,
                      profile: null,
                      token: null,
                      isAuthenticated: false,
                      isAdmin: false,
                    });
                  }
                }
              });
            }
          } catch (err) {
            console.warn("Auth initialization error:", err);
            set({ isInitialized: true });
          } finally {
            initPromise = null;
          }
        })();
        return initPromise;
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          if (!SUPABASE_ANON_KEY) {
            set({ isLoading: false });
            return {
              success: false,
              error: "Authentication service is unavailable. Please check system configuration.",
            };
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.session) {
            const token = data.session.access_token;
            const profile = await get().syncBackendProfile(
              token,
              data.user.user_metadata?.name || data.user.user_metadata?.full_name
            );

            if (!profile) {
              syncAuthCookie(null);
              await supabase.auth.signOut().catch(() => {});
              set({
                user: null,
                profile: null,
                token: null,
                isAuthenticated: false,
                isAdmin: false,
                isLoading: false,
              });
              return {
                success: false,
                error: "Authentication verified, but unable to synchronize patron profile with Atelier services.",
              };
            }

            syncAuthCookie(token);
            set({
              user: { id: data.user.id, email: data.user.email || "" },
              profile,
              token,
              isAuthenticated: true,
              isAdmin: profile.role === "admin",
              isLoading: false,
            });
            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: "Authentication failed. No session created." };
        } catch (err: unknown) {
          set({ isLoading: false });
          const message = err instanceof Error ? err.message : "An unexpected error occurred.";
          return { success: false, error: message };
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true });
        try {
          if (!SUPABASE_ANON_KEY) {
            set({ isLoading: false });
            return {
              success: false,
              error: "Registration service is unavailable. Please check system configuration.",
            };
          }

          // Compute exact local development / production redirect URL
          const origin =
            typeof window !== "undefined" && window.location.origin
              ? window.location.origin
              : "http://localhost:3000";
          const emailRedirectTo = `${origin}/auth/callback`;

          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo,
              data: {
                name: name.trim(),
                full_name: name.trim(),
              },
            },
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          // Case 1: Session established immediately (email confirmation disabled in Supabase)
          if (data.session) {
            const token = data.session.access_token;
            const profile = await get().syncBackendProfile(token, name);

            if (!profile) {
              syncAuthCookie(null);
              set({
                user: null,
                profile: null,
                token: null,
                isAuthenticated: false,
                isAdmin: false,
                isLoading: false,
              });
              return {
                success: false,
                error: "Account created, but profile synchronization failed. Please try signing in.",
              };
            }

            syncAuthCookie(token);
            set({
              user: { id: data.user?.id || "", email: data.user?.email || "" },
              profile,
              token,
              isAuthenticated: true,
              isAdmin: profile.role === "admin",
              isLoading: false,
            });
            return { success: true, needsEmailConfirmation: false };
          }

          // Case 2: User created but confirmation email sent (data.session is null)
          set({ isLoading: false });
          return {
            success: true,
            needsEmailConfirmation: true,
            email: data.user?.email || email.trim(),
          };
        } catch (err: unknown) {
          set({ isLoading: false });
          const message = err instanceof Error ? err.message : "Registration failed.";
          return { success: false, error: message };
        }
      },

      resendConfirmation: async (email: string) => {
        try {
          if (!SUPABASE_ANON_KEY) {
            return { success: true };
          }

          const origin =
            typeof window !== "undefined" && window.location.origin
              ? window.location.origin
              : "http://localhost:3000";
          const emailRedirectTo = `${origin}/auth/callback`;

          const { error } = await supabase.auth.resend({
            type: "signup",
            email: email.trim(),
            options: {
              emailRedirectTo,
            },
          });

          if (error) {
            return { success: false, error: error.message };
          }

          return { success: true };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to resend confirmation email.";
          return { success: false, error: message };
        }
      },

      verifyEmailOtp: async (email: string, token: string) => {
        set({ isLoading: true });
        try {
          if (!SUPABASE_ANON_KEY) {
            set({ isLoading: false });
            return { success: true };
          }

          const { data, error } = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: token.trim(),
            type: "signup",
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.session) {
            const accessToken = data.session.access_token;
            const profile = await get().syncBackendProfile(
              accessToken,
              data.user?.user_metadata?.name || data.user?.user_metadata?.full_name
            );

            if (!profile) {
              syncAuthCookie(null);
              set({
                user: null,
                profile: null,
                token: null,
                isAuthenticated: false,
                isAdmin: false,
                isLoading: false,
              });
              return {
                success: false,
                error: "Email verified, but profile synchronization failed. Please sign in.",
              };
            }

            syncAuthCookie(accessToken);
            set({
              user: { id: data.user?.id || "", email: data.user?.email || "" },
              profile,
              token: accessToken,
              isAuthenticated: true,
              isAdmin: profile.role === "admin",
              isLoading: false,
            });
            return { success: true };
          }

          set({ isLoading: false });
          return { success: true };
        } catch (err: unknown) {
          set({ isLoading: false });
          const message = err instanceof Error ? err.message : "Verification failed.";
          return { success: false, error: message };
        }
      },

      logout: async () => {
        try {
          if (SUPABASE_ANON_KEY) {
            await supabase.auth.signOut();
          }
        } finally {
          syncAuthCookie(null);
          try {
            if (typeof window !== "undefined") {
              localStorage.removeItem("aurel-auth-store");
            }
          } catch {}
          set({
            user: null,
            profile: null,
            token: null,
            isAuthenticated: false,
            isAdmin: false,
          });
        }
      },

      resetPassword: async (email: string) => {
        try {
          if (!SUPABASE_ANON_KEY) {
            return { success: true };
          }
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/login?reset=true`,
          });
          if (error) {
            return { success: false, error: error.message };
          }
          return { success: true };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to send reset email.";
          return { success: false, error: message };
        }
      },

      syncBackendProfile: async (token: string, name?: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/auth/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: name || undefined }),
            signal: controller.signal,
          });

          if (res.ok) {
            const data = await res.json();
            return {
              id: data.id,
              email: data.email,
              name: data.name,
              role: data.role,
              createdAt: data.created_at,
            };
          } else {
            const errText = await res.text();
            console.error(`Backend auth sync failed [HTTP ${res.status}]:`, errText);
          }
        } catch (err) {
          console.warn("Could not sync profile with backend:", err);
        } finally {
          clearTimeout(timeoutId);
        }
        return null;
      },

      refreshProfile: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          let tokenToUse = get().token;

          // Always get the freshest active token from Supabase if possible
          if (SUPABASE_ANON_KEY) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const now = Math.floor(Date.now() / 1000);
              if (session.expires_at && session.expires_at <= now + 60) {
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (refreshData?.session) {
                  tokenToUse = refreshData.session.access_token;
                }
              } else {
                tokenToUse = session.access_token;
              }
            } else if (!tokenToUse) {
              return null;
            }
          }

          if (!tokenToUse) return null;

          const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
            headers: {
              Authorization: `Bearer ${tokenToUse}`,
            },
            cache: "no-store",
            signal: controller.signal,
          });

          if (res.status === 401) {
            // Token rejected on /auth/me — cleanly sign out
            await get().logout();
            return null;
          }

          if (res.ok) {
            const data = await res.json();
            const profile: UserProfile = {
              id: data.id,
              email: data.email,
              name: data.name,
              role: data.role,
              createdAt: data.created_at,
            };
            syncAuthCookie(tokenToUse);
            set({
              user: { id: data.id, email: data.email },
              profile,
              token: tokenToUse,
              isAdmin: profile.role === "admin",
              isAuthenticated: true,
            });
            return profile;
          }
        } catch (err) {
          console.warn("Could not refresh profile with backend:", err);
        } finally {
          clearTimeout(timeoutId);
        }
        return null;
      },

      setProfile: (profile: UserProfile) => {
        set({ profile, isAdmin: profile.role === "admin" });
      },
    }),
    {
      name: "aurel-auth-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.isAuthenticated && state.profile ? state.user : null,
        profile: state.isAuthenticated ? state.profile : null,
        token: state.isAuthenticated && state.profile ? state.token : null,
        isAuthenticated: state.isAuthenticated && Boolean(state.profile),
        isAdmin: state.isAuthenticated && state.profile?.role === "admin",
      }),
    }
  )
);
