import type { IntegrationHealth } from '@gameshelf/contracts';

type Key = IntegrationHealth['key'];

type Probe = {
  key: Key;
  name: string;
  envVars: string[];
  configured: boolean;
  /** Chamada leve que prova que a integração funciona; devolve uma frase curta de sucesso. */
  check?: () => Promise<string>;
};

type Outcome = { at: Date; ok: boolean; message: string };

/**
 * Saúde das integrações (ADR-040): diz se cada uma está configurada e como foi a
 * última chamada, sem exigir conferir o .env. O estado vive em memória — é um
 * diagnóstico do que aconteceu desde que a API subiu, não um histórico.
 */
export class IntegrationHealthTracker {
  private readonly probes = new Map<Key, Probe>();
  private readonly last = new Map<Key, Outcome>();
  private readonly lastSuccess = new Map<Key, Date>();

  register(probe: Probe): void {
    this.probes.set(probe.key, probe);
  }

  record(key: Key, ok: boolean, message: string): void {
    const at = new Date();
    this.last.set(key, { at, ok, message });
    if (ok) this.lastSuccess.set(key, at);
  }

  /**
   * Envolve um provider para registrar o resultado das chamadas reais (busca de
   * metadados, conquistas...). A mensagem de erro vem do provider, que nunca
   * repete chaves ou senhas.
   */
  track<T extends object>(key: Key, provider: T, methods: string[]): T {
    return new Proxy(provider, {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver) as unknown;
        if (typeof value !== 'function') return value;
        const bound = (value as (...args: unknown[]) => unknown).bind(target);
        if (typeof property !== 'string' || !methods.includes(property)) return bound;
        return async (...args: unknown[]) => {
          try {
            const result = await bound(...args);
            this.record(key, true, `${property} respondeu normalmente.`);
            return result;
          } catch (error) {
            this.record(key, false, error instanceof Error ? error.message : 'Falha ao chamar a integração.');
            throw error;
          }
        };
      },
    });
  }

  snapshot(): IntegrationHealth[] {
    return [...this.probes.values()].map((probe) => {
      const outcome = this.last.get(probe.key);
      return {
        key: probe.key, name: probe.name, configured: probe.configured, envVars: probe.envVars,
        lastCheckedAt: outcome?.at.toISOString() ?? null,
        lastOk: outcome?.ok ?? null,
        lastSuccessAt: this.lastSuccess.get(probe.key)?.toISOString() ?? null,
        lastMessage: outcome?.message ?? null,
      };
    });
  }

  /** Executa a chamada leve da integração agora e registra o resultado. */
  async test(key: Key): Promise<IntegrationHealth | undefined> {
    const probe = this.probes.get(key);
    if (!probe) return undefined;
    if (!probe.configured || !probe.check) {
      this.record(key, false, probe.configured ? 'Esta integração não sabe se testar.' : `Não configurada: defina ${probe.envVars.join(', ')}.`);
    } else {
      try {
        this.record(key, true, await probe.check());
      } catch (error) {
        this.record(key, false, error instanceof Error ? error.message : 'Falha ao chamar a integração.');
      }
    }
    return this.snapshot().find((item) => item.key === key);
  }
}
