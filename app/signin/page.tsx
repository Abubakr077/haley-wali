import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Store Manager Sign In",
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo = "/" } = await searchParams;
  return (
    <main className="admin-signin-page">
      <section>
        <p className="eyebrow">HALEY WALI · PRIVATE AREA</p>
        <h1>STORE<br />MANAGER</h1>
        <p>Sign in to manage articles, stock, customer orders and requests.</p>
        <SignInForm returnTo={returnTo} />
      </section>
    </main>
  );
}
