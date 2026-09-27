import { teamMessages } from "@/platform/messages";
import { logInAction } from "./actions";

const { login } = teamMessages;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{login.title}</h1>
      <form action={logInAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          {login.username}
          <input name="username" autoComplete="username" autoCapitalize="none" required className="border p-2" />
        </label>
        <label className="flex flex-col gap-1">
          {login.password}
          <input name="password" type="password" autoComplete="current-password" required className="border p-2" />
        </label>
        {error === "login-failed" && <p role="alert">{login.failed}</p>}
        {error === "login-locked" && <p role="alert">{login.locked}</p>}
        <button type="submit" className="border p-2">
          {login.submit}
        </button>
      </form>
    </main>
  );
}
