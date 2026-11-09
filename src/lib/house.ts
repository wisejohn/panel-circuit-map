import type { Circuit, Device, DeviceType, House, Room } from './types';

export const DEVICE_TYPES: { type: DeviceType; name: string; plural: string; short: string }[] = [
	{ type: 'rec', name: 'receptacle', plural: 'receptacles', short: 'Receptacles' },
	{ type: 'gfci', name: 'GFCI receptacle', plural: 'GFCI receptacles', short: 'GFCI' },
	{ type: 'light', name: 'light', plural: 'lights', short: 'Lights' },
	{ type: 'fan', name: 'fan', plural: 'fans', short: 'Fans' },
	{ type: 'smoke', name: 'smoke detector', plural: 'smoke detectors', short: 'Smoke' },
	{ type: 'appl', name: 'appliance', plural: 'appliances', short: 'Appliances' },
];
export const TYPE_INFO = Object.fromEntries(DEVICE_TYPES.map((t) => [t.type, t])) as Record<
	DeviceType,
	(typeof DEVICE_TYPES)[number]
>;

const APPLIANCE_CODES: Record<string, string> = {
	microwave: 'MW',
	dishwasher: 'DW',
	disposal: 'DISP',
	refrigerator: 'FRIDGE',
	'water heater': 'WH',
	'a/c condenser': 'A/C',
	'garage door opener': 'OPENER',
	'ev charger': 'EV',
	furnace: 'FURN',
	'sump pump': 'SUMP',
};

/** Short code drawn inside an appliance symbol. */
export function applianceCode(label: string): string {
	const known = APPLIANCE_CODES[label.trim().toLowerCase()];
	if (known) return known;
	const code = label.trim().toUpperCase().slice(0, 6);
	return code || 'APPL';
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function newId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function findCircuit(house: House, id: string | null | undefined): Circuit | undefined {
	return id ? house.circuits.find((c) => c.id === id) : undefined;
}

/** A circuit plus every circuit in any subpanel it feeds (recursively). */
export function expandCircuit(house: House, id: string): Set<string> {
	const out = new Set([id]);
	const queue = [id];
	while (queue.length) {
		const cid = queue.pop()!;
		for (const p of house.panels) {
			if (p.fedBy !== cid) continue;
			for (const c of house.circuits) {
				if (c.panelId === p.id && !out.has(c.id)) {
					out.add(c.id);
					queue.push(c.id);
				}
			}
		}
	}
	return out;
}

export function isFeeder(house: House, circuitId: string): boolean {
	return house.panels.some((p) => p.fedBy === circuitId);
}

/** Circuits ordered by panel (house order) then by first breaker slot. */
export function sortedCircuits(house: House): Circuit[] {
	const panelIndex = new Map(house.panels.map((p, i) => [p.id, i]));
	return [...house.circuits].sort(
		(a, b) => (panelIndex.get(a.panelId) ?? 0) - (panelIndex.get(b.panelId) ?? 0) || a.slots[0] - b.slots[0],
	);
}

/** Slots taken by a breaker starting at `start`. Double-pole breakers skip a row on the same side (1 → 1, 3). */
export const slotsFor = (start: number, poles: number) => (poles === 2 ? [start, start + 2] : [start]);

export function usedSlots(house: House, panelId: string, exceptCircuitId?: string): Set<number> {
	return new Set(
		house.circuits.filter((c) => c.panelId === panelId && c.id !== exceptCircuitId).flatMap((c) => c.slots),
	);
}

/** Starting slots where a breaker with this many poles fits. */
export function validStarts(house: House, panelId: string, poles: number, exceptCircuitId?: string): number[] {
	const panel = house.panels.find((p) => p.id === panelId);
	if (!panel) return [];
	const used = usedSlots(house, panelId, exceptCircuitId);
	const out: number[] = [];
	for (let s = 1; s <= panel.spaces; s++) {
		const slots = slotsFor(s, poles);
		if (slots.every((x) => x <= panel.spaces && !used.has(x))) out.push(s);
	}
	return out;
}

/** Highest slot in use, rounded up to an even number: the fewest spaces the panel can shrink to. */
export function minSpaces(house: House, panelId: string): number {
	const max = Math.max(0, ...usedSlots(house, panelId));
	return Math.max(2, max + (max % 2));
}

/** A panel plus every panel fed from it, directly or through other subpanels. */
export function downstreamPanels(house: House, panelId: string): Set<string> {
	const out = new Set([panelId]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const p of house.panels) {
			if (out.has(p.id) || !p.fedBy) continue;
			const feeder = house.circuits.find((c) => c.id === p.fedBy);
			if (feeder && out.has(feeder.panelId)) {
				out.add(p.id);
				grew = true;
			}
		}
	}
	return out;
}

/** Circuits that could feed this panel without creating a loop. */
export function feederOptions(house: House, panelId: string): Circuit[] {
	const blocked = downstreamPanels(house, panelId);
	return sortedCircuits(house).filter((c) => !blocked.has(c.panelId));
}

export function roomOf(house: House, d: Device): Room | undefined {
	return house.rooms.find(
		(r) => r.floorId === d.floorId && d.x >= r.x && d.x <= r.x + r.w && d.y >= r.y && d.y <= r.y + r.h,
	);
}

export const roomName = (house: House, d: Device) => roomOf(house, d)?.name ?? 'Exterior';

export function deviceName(d: Device): string {
	if (d.type === 'appl') return d.label || 'Appliance';
	return cap(TYPE_INFO[d.type].name) + (d.label ? ` (${d.label})` : '');
}

export function circuitRef(house: House, c: Circuit): string {
	const p = house.panels.find((p) => p.id === c.panelId);
	return `${p?.short ?? '?'} ${c.slots.join('/')}`;
}

export function countBy(devices: Device[]): Partial<Record<DeviceType, number>> {
	const by: Partial<Record<DeviceType, number>> = {};
	for (const d of devices) by[d.type] = (by[d.type] ?? 0) + 1;
	return by;
}

export function countsText(devices: Device[]): string {
	const by = countBy(devices);
	return DEVICE_TYPES.filter((t) => by[t.type])
		.map((t) => `${by[t.type]} ${by[t.type] === 1 ? t.name : t.plural}`)
		.join(' · ');
}

/** "Kitchen, Dining" on one floor; "Main: Kitchen · Bsmt: Utility" across floors. */
export function roomsText(house: House, devices: Device[]): string {
	const floors = house.floors.filter((f) => devices.some((d) => d.floorId === f.id));
	const names = (fid: string) =>
		[...new Set(devices.filter((d) => d.floorId === fid).map((d) => roomName(house, d)))].join(', ');
	if (floors.length === 0) return '';
	if (floors.length === 1) {
		const f = floors[0];
		return names(f.id) + (f.id !== house.floors[0].id ? ` (${f.name.toLowerCase()})` : '');
	}
	return floors.map((f) => `${f.short}: ${names(f.id)}`).join(' · ');
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Bounding box of every room and device on every floor, so stacked floors line up. */
export function planBounds(house: House, pad: number): Box {
	let x0 = Infinity,
		y0 = Infinity,
		x1 = -Infinity,
		y1 = -Infinity;
	for (const r of house.rooms) {
		x0 = Math.min(x0, r.x);
		y0 = Math.min(y0, r.y);
		x1 = Math.max(x1, r.x + r.w);
		y1 = Math.max(y1, r.y + r.h);
	}
	for (const d of house.devices) {
		x0 = Math.min(x0, d.x - 1.5);
		y0 = Math.min(y0, d.y - 1);
		x1 = Math.max(x1, d.x + 1.5);
		y1 = Math.max(y1, d.y + 1);
	}
	if (!isFinite(x0)) return { x: -pad, y: -pad, w: 40 + 2 * pad, h: 30 + 2 * pad };
	return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}
