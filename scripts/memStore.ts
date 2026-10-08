import type { AccessConfig, Entitlement, PaymentRecord, Reservation, Store, Tx } from '../functions/src/core';

/**
 * In-memory Store with Firestore-like OPTIMISTIC concurrency: a transaction records the version of everything it read and is
 * retried if any of it changed before commit. It deliberately yields between reads so concurrent transactions interleave,
 * which is what makes the seat-cap tests meaningful (no global lock hides a race).
 */
export class MemStore implements Store {
  config: AccessConfig | undefined;
  ents = new Map<string, Entitlement>();
  res = new Map<string, Reservation>();
  pays = new Map<string, PaymentRecord>();
  private ver = new Map<string, number>();
  retries = 0;
  private v = (k: string) => this.ver.get(k) ?? 0;
  private bump = (k: string) => this.ver.set(k, this.v(k) + 1);
  private yieldNow = () => new Promise<void>((r) => setImmediate(r));

  async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (;;) {
      const reads = new Map<string, number>();
      const writes: Array<() => void> = [];
      const touch = async (k: string) => { await this.yieldNow(); reads.set(k, this.v(k)); };
      const clone = <X>(x: X): X => (x === undefined ? x : structuredClone(x));
      const tx: Tx = {
        config: async () => { await touch('config'); return clone(this.config); },
        setConfig: (c) => { writes.push(() => { this.config = clone(c); this.bump('config'); }); },
        entitlement: async (uid) => { await touch(`ent:${uid}`); return clone(this.ents.get(uid)); },
        setEntitlement: (uid, e) => { writes.push(() => { this.ents.set(uid, clone(e)); this.bump(`ent:${uid}`); }); },
        reservations: async () => { await touch('res'); return [...this.res.values()].map((r) => clone(r)); },
        setReservation: (r) => { writes.push(() => { this.res.set(r.uid, clone(r)); this.bump('res'); }); },
        deleteReservation: (uid) => { writes.push(() => { if (this.res.delete(uid)) this.bump('res'); }); },
        payment: async (id) => { await touch(`pay:${id}`); return clone(this.pays.get(id)); },
        setPayment: (p) => { writes.push(() => { this.pays.set(p.sessionId, clone(p)); this.bump(`pay:${p.sessionId}`); }); },
      };
      const out = await fn(tx);
      const stale = [...reads].some(([k, ver]) => this.v(k) !== ver);
      if (stale) { this.retries++; continue; }
      writes.forEach((w) => w());
      return out;
    }
  }
}
