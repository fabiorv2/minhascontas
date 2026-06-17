import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Erro no app", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="empty-state">
            <h1>Minhas Contas</h1>
            <p>Algo falhou ao carregar a tela. Feche e abra o app novamente.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
