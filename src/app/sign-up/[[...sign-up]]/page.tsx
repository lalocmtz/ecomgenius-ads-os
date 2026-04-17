import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <SignUp appearance={{ variables: { colorPrimary: "#00e87b" } }} />
    </main>
  );
}
