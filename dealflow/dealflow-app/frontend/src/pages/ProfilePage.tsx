import React, { useEffect, useState } from "react";
import { useAuth, useAuthConfig } from "@auth-module/frontend";
import { AuthApiClient } from "@auth-module/frontend";
import { PublicUser } from "@auth-module/core";

// ---------------------------------------------------------------------------
// ProfilePage — demonstrates fetching server-side data from a protected
// application endpoint (/api/v1/profile) using the access token automatically
// attached by AuthApiClient.
// ---------------------------------------------------------------------------

interface ProfileData {
  user: PublicUser;
  subscription: string;
  preferences: { theme: string; notifications: boolean };
}

export function ProfilePage() {
  const { accessToken } = useAuth();
  const { config } = useAuthConfig();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = new AuthApiClient(config.apiBaseUrl, () => accessToken);

    // Fetch app-specific profile endpoint (defined in example-app/backend)
    void (async () => {
      try {
        const res = await (client as unknown as { http: { get: (url: string) => Promise<{ data: { data: ProfileData } }> } })["http"].get("/profile");
        setProfile(res.data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, config.apiBaseUrl]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
        Loading profile…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "16px", color: "#dc2626" }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <div style={cardStyle}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px", color: "#111827" }}>
          My Profile
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "24px" }}>
          Data fetched from the protected <code>/api/v1/profile</code> endpoint.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field label="Name" value={profile?.user.name ?? "—"} />
          <Field label="Email" value={profile?.user.email ?? "—"} />
          <Field label="Subscription" value={profile?.subscription ?? "—"} />
          <Field label="Theme" value={profile?.preferences.theme ?? "—"} />
          <Field label="Notifications" value={profile?.preferences.notifications ? "Enabled" : "Disabled"} />
          <Field label="Last login" value={profile?.user.lastLoginAt ? new Date(profile.user.lastLoginAt).toLocaleString() : "—"} />
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: "16px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
        <p style={{ fontSize: "13px", color: "#166534" }}>
          <strong>How this works:</strong> The access token stored in memory by AuthContext is automatically
          attached to every request made by AuthApiClient via its Axios interceptor.
          No manual token management required in your components.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "2px" }}>
        {label}
      </p>
      <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>{value}</p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "24px",
};
