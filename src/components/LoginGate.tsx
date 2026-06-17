import { useState, type ReactNode } from "react";

const ACCESS_KEY = "minhas-contas:access-granted";
const PASSPHRASE = "Irlanda";

function readAccess(): boolean {
  try {
    return localStorage.getItem(ACCESS_KEY) === "true";
  } catch {
    return false;
  }
}

function saveAccess(): void {
  try {
    localStorage.setItem(ACCESS_KEY, "true");
  } catch {
    undefined;
  }
}

interface LoginGateProps {
  children: ReactNode;
}

export function LoginGate({ children }: LoginGateProps) {
  const [unlocked, setUnlocked] = useState(readAccess);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passphrase.trim() === PASSPHRASE) {
      saveAccess();
      setUnlocked(true);
      return;
    }

    setError("Palavra-passe incorreta.");
  }

  if (unlocked) return <>{children}</>;

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div>
          <p>Minhas Contas</p>
          <h1>Acesso restrito</h1>
        </div>
        <label>
          Palavra-passe
          <input
            type="password"
            value={passphrase}
            onChange={(event) => {
              setPassphrase(event.target.value);
              setError("");
            }}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error && <span className="login-error">{error}</span>}
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
