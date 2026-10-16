import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@gameshelf/ui';

let shouldThrow = true;

function Flaky() {
  if (shouldThrow) throw new Error('falha simulada na tela');
  return <p>tela recuperada</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // O React registra a falha no console; silenciamos para manter a saída limpa.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('mostra um estado recuperável em vez de desmontar a aplicação', () => {
    render(<ErrorBoundary title="Não foi possível abrir a tela"><Flaky /></ErrorBoundary>);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir a tela');
    expect(alert).toHaveTextContent('falha simulada na tela');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('volta a renderizar a tela ao tentar novamente', () => {
    render(<ErrorBoundary><Flaky /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado nesta tela');

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('tela recuperada')).toBeInTheDocument();
  });
});
