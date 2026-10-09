import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const next = (await searchParams).next;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold">Van admin</h1>
      <p className="mb-6 text-sm text-slate-600">Sign in to manage trips and seats.</p>
      <LoginForm next={typeof next === "string" ? next : ""} />
    </main>
  );
}
