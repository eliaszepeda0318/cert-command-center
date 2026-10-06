import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAppData } from '../context/AppDataContext';
import type { Blueprint, BlueprintObjective, ObjectiveMapping } from '../types';

export interface BlueprintData { blueprint: Blueprint; objectives: BlueprintObjective[]; mappings: ObjectiveMapping[] }
const cache = new Map<string, BlueprintData>(); // ~270 reference docs: read once per page load, and only when a screen needs them

/** Lazily loads the active certification's blueprint (so Dashboard and Study never pay for it). */
export function useBlueprint() {
  const { activeCert } = useAppData();
  const bid = activeCert?.activeBlueprintId ?? null;
  const [data, setData] = useState<BlueprintData | null>(bid ? cache.get(bid) ?? null : null);
  const [loading, setLoading] = useState(!!bid && !cache.has(bid));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!bid) { setLoading(false); return; }
    const hit = cache.get(bid); if (hit) { setData(hit); setLoading(false); return; }
    let live = true; setLoading(true);
    (async () => {
      try {
        const scope = where('blueprintId', '==', bid);
        const [b, o, m] = await Promise.all([getDoc(doc(db, 'blueprints', bid)), getDocs(query(collection(db, 'blueprintObjectives'), scope)), getDocs(query(collection(db, 'lessonObjectiveMappings'), scope))]);
        if (!b.exists()) throw new Error(`Blueprint ${bid} is not seeded. Run npm run seed.`);
        const out: BlueprintData = { blueprint: b.data() as Blueprint, objectives: o.docs.map((d) => d.data() as BlueprintObjective).sort((x, y) => x.order - y.order), mappings: m.docs.map((d) => d.data() as ObjectiveMapping) };
        cache.set(bid, out); if (live) setData(out);
      } catch (e) { if (live) setError((e as Error).message); }
      if (live) setLoading(false);
    })();
    return () => { live = false; };
  }, [bid]);
  return { data, loading, error, hasBlueprint: !!bid };
}
