import type { Database } from '../../database.js';
export type SandboxOutcome = 'confirmed' | 'rejected';
export type SandboxEvent = { eventId: string; outcome: SandboxOutcome };
export interface SandboxGateway {
  submit(reference: string, scenario: string): Promise<SandboxEvent>;
  lookup(reference: string, scenario: string): Promise<SandboxEvent | null>;
}
export class UnknownSandboxResult extends Error {}
/** PSP falso durável, sem credenciais, HTTP, dinheiro real ou destino bancário. */
export class SandboxProvider implements SandboxGateway {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}
  async submit(reference: string, scenario: string): Promise<SandboxEvent> {
    if (!['approve', 'decline', 'timeout_after_accept'].includes(scenario))
      throw new Error('UNSUPPORTED_SCENARIO');
    const outcome = scenario === 'decline' ? 'rejected' : 'confirmed';
    await this.db.financeSandboxReceipt.createMany({
      data: [{ tenantId: this.tenantId, topupId: reference, outcome }],
      skipDuplicates: true,
    });
    if (scenario === 'timeout_after_accept') throw new UnknownSandboxResult('UNKNOWN_RESULT');
    return (await this.lookup(reference))!;
  }
  async lookup(reference: string): Promise<SandboxEvent | null> {
    const receipt = await this.db.financeSandboxReceipt.findUnique({
      where: { tenantId_topupId: { tenantId: this.tenantId, topupId: reference } },
    });
    return receipt
      ? {
          eventId: `fake:${reference}:${receipt.outcome}`,
          outcome: receipt.outcome as SandboxOutcome,
        }
      : null;
  }
}
