import React, { useState } from "react";
import { useAuth } from "@auth-module/frontend";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// Razorpay checkout – loaded on demand from the CDN.
// ---------------------------------------------------------------------------
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// DashboardPage — example protected page that uses the useAuth() hook.
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);

  async function handlePayment() {
    setPaying(true);
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      alert("Failed to load Razorpay SDK. Please check your internet connection.");
      setPaying(false);
      return;
    }

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: 100,            // amount in paise (100 paise = ₹1)
      currency: "INR",
      name: "Auth Module Demo",
      description: "Test Payment",
      image: "https://razorpay.com/favicon.png",
      prefill: {
        name: user?.name ?? "",
        email: user?.email ?? "",
        contact: user?.phone ?? "",
      },
      theme: { color: "#6366f1" },
      handler: function (response: { razorpay_payment_id: string }) {
        alert(`Payment successful! Payment ID: ${response.razorpay_payment_id}`);
      },
      modal: {
        ondismiss: function () {
          setPaying(false);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", function (resp: { error: { description: string } }) {
      alert(`Payment failed: ${resp.error.description}`);
      setPaying(false);
    });
    rzp.open();
    setPaying(false);
  }

  return (
    <div>
      {/* Welcome card */}
      <div style={cardStyle}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px", color: "#111827" }}>
          Welcome back, {user?.name ?? "User"} 👋
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          You're successfully authenticated via the auth module.
        </p>
      </div>

      {/* User info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "24px" }}>
        <InfoCard label="User ID" value={user?.id ?? "—"} />
        <InfoCard label="Email" value={user?.email ?? "—"} />
        <InfoCard label="Phone" value={user?.phone ?? "—"} />
        <InfoCard label="Verified" value={user?.isVerified ? "✅ Yes" : "❌ No"} />
        <InfoCard label="Status" value={user?.status ?? "—"} />
        <InfoCard label="Member since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} />
        <InfoCard label="Last login" value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"} />
      </div>

      {/* Payment */}
      <div style={{ marginTop: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px", color: "#111827" }}>
          Payments
        </h2>
        <button
          onClick={handlePayment}
          disabled={paying}
          style={payButtonStyle}
          onMouseOver={(e) => {
            if (!paying) (e.currentTarget as HTMLButtonElement).style.background = "#4f46e5";
          }}
          onMouseOut={(e) => {
            if (!paying) (e.currentTarget as HTMLButtonElement).style.background = "#6366f1";
          }}
        >
          {paying ? "Opening…" : "💳 Pay ₹1 via Razorpay"}
        </button>
        <p style={{ marginTop: "8px", fontSize: "12px", color: "#9ca3af" }}>
          Test mode — use card <strong>4111 1111 1111 1111</strong>, any future expiry, any CVV.
        </p>
      </div>

      {/* Quick links */}
      <div style={{ marginTop: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px", color: "#111827" }}>
          Quick links
        </h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link to="/profile" style={linkButtonStyle}>View Profile →</Link>
          <a
            href="/api/v1/auth/me"
            target="_blank"
            rel="noopener noreferrer"
            style={linkButtonStyle}
          >
            Raw /me endpoint →
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...cardStyle, padding: "16px" }}>
      <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "4px" }}>
        {label}
      </p>
      <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827", wordBreak: "break-all" }}>
        {value}
      </p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "24px",
};

const payButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "10px 20px",
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s ease",
};

const linkButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 16px",
  background: "#f3f4f6",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#374151",
  textDecoration: "none",
  fontWeight: 500,
  border: "1px solid #e5e7eb",
};
