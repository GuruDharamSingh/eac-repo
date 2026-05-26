import { LoginForm } from "@/components/login-form";
import { siteConfig } from "@/config/site";

export const metadata = { title: "IFAC Admin Login" };

export default function LoginPage() {
  return (
    <main className="login-screen">
      <section className="login-card">
        <p className="kicker">IFAC admin</p>
        <h1 className="section-title" style={{ fontSize: "2.25rem" }}>{siteConfig.shortName}</h1>
        <p className="body-copy">Sign in to manage IFAC content, events, users and sign-ups.</p>
        <LoginForm />
      </section>
    </main>
  );
}
