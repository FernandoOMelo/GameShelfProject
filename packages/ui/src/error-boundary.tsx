import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Título mostrado no lugar da tela que falhou. */
  title?: string;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * Evita tela branca: captura falhas de renderização (por exemplo, a resposta
 * inesperada de uma API ou o carregamento offline de um chunk) e mostra um
 * estado recuperável em vez de desmontar a aplicação inteira.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GameShelf: falha ao renderizar uma tela.', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <section className="empty-state" role="alert">
      <span className="empty-icon" aria-hidden="true">!</span>
      <h2>{this.props.title ?? 'Algo deu errado nesta tela'}</h2>
      <p>{error.message}</p>
      <button type="button" className="gameshelf-button" onClick={() => this.setState({ error: null })}>Tentar novamente</button>
    </section>;
  }
}
