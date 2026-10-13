import type { CellSpec, OrganelleMeta } from '../types';
import rawOrganelles from '../data/organelles.json';
import rawCells from '../data/cells.json';

export const ORGANELLES: OrganelleMeta[] = rawOrganelles as OrganelleMeta[];
export const CELLS: CellSpec[] = rawCells as CellSpec[];

const byId = new Map(ORGANELLES.map((o) => [o.id, o]));
const cellsById = new Map(CELLS.map((c) => [c.id, c]));

export function organelleById(id: string): OrganelleMeta {
  const o = byId.get(id);
  if (!o) throw new Error(`organelleById: unknown id "${id}" (add it to organelles.json)`);
  return o;
}

export function cellById(id: string): CellSpec {
  const c = cellsById.get(id);
  if (!c) throw new Error(`cellById: unknown id "${id}" (add it to cells.json)`);
  return c;
}

export function localized(loc: { en: string; fr?: string }, lang: 'en' | 'fr'): string {
  return lang === 'fr' && loc.fr ? loc.fr : loc.en;
}
