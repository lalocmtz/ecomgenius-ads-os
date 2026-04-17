import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <SignIn appearance={{ variables: { colorPrimary: "#00e87b" } }} />
    </main>
  );
}
