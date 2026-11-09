import type { Circuit, Device, DeviceType, House, Room, TraceImage } from './types';

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
		(a, b) =>
			(panelIndex.get(a.panelId) ?? 0) - (panelIndex.get(b.panelId) ?? 0) ||
			a.slots[0] - b.slots[0] ||
			(a.half === 'b' ? 1 : 0) - (b.half === 'b' ? 1 : 0),
	);
}

/* ---------- Breaker geometry ----------
 * Spaces are numbered odd down the left column and even down the right, so space s is in
 * row ceil(s / 2). A breaker is one of:
 *   single  – one space
 *   half    – one half of a tandem (twin) breaker; two halves share a space
 *   stacked – 240 V double-pole on one side, two rows tall (1 + 3)
 *   across  – 240 V double-pole spanning both columns in one row (1 + 2)
 */
export type BreakerKind = 'single' | 'half' | 'stacked' | 'across';

export const BREAKER_KINDS: { kind: BreakerKind; name: string }[] = [
	{ kind: 'single', name: 'Single' },
	{ kind: 'half', name: 'Tandem half' },
	{ kind: 'stacked', name: '240 V stacked' },
	{ kind: 'across', name: '240 V across' },
];

export function breakerKind(c: Pick<Circuit, 'slots' | 'half'>): BreakerKind {
	if (c.half) return 'half';
	if (c.slots.length === 1) return 'single';
	return c.slots[1] === c.slots[0] + 1 ? 'across' : 'stacked';
}

export const rowOf = (slot: number) => Math.ceil(slot / 2);
export const isRight = (slot: number) => slot % 2 === 0;

export interface Placement {
	slots: number[];
	half?: 'a' | 'b';
}

export const placementKey = (p: Placement) => p.slots.join('-') + (p.half ?? '');

export function placementLabel(p: Placement): string {
	const row = rowOf(p.slots[0]);
	const side = isRight(p.slots[0]) ? 'right' : 'left';
	if (p.half) return `Row ${row} ${side}, ${p.half === 'a' ? 'upper' : 'lower'} half`;
	if (p.slots.length === 1) return `Row ${row} ${side}`;
	if (p.slots[1] === p.slots[0] + 1) return `Row ${row}, both sides`;
	return `Rows ${row}–${row + 1} ${side}`;
}

interface Occupied {
	full: boolean;
	a: boolean;
	b: boolean;
}

function occupancy(house: House, panelId: string, exceptCircuitId?: string): Map<number, Occupied> {
	const map = new Map<number, Occupied>();
	for (const c of house.circuits) {
		if (c.panelId !== panelId || c.id === exceptCircuitId) continue;
		for (const s of c.slots) {
			const o = map.get(s) ?? { full: false, a: false, b: false };
			if (c.half) o[c.half] = true;
			else o.full = true;
			map.set(s, o);
		}
	}
	return map;
}

/** Every place a breaker of this kind could go. */
export function validPlacements(
	house: House,
	panelId: string,
	kind: BreakerKind,
	exceptCircuitId?: string,
): Placement[] {
	const panel = house.panels.find((p) => p.id === panelId);
	if (!panel) return [];
	const occ = occupancy(house, panelId, exceptCircuitId);
	const empty = (s: number) => s <= panel.spaces && !occ.get(s);
	const out: Placement[] = [];
	for (let s = 1; s <= panel.spaces; s++) {
		if (kind === 'single' && empty(s)) out.push({ slots: [s] });
		if (kind === 'half') {
			const o = occ.get(s);
			for (const half of ['a', 'b'] as const) if (!o?.full && !o?.[half]) out.push({ slots: [s], half });
		}
		if (kind === 'stacked' && empty(s) && empty(s + 2)) out.push({ slots: [s, s + 2] });
		if (kind === 'across' && !isRight(s) && empty(s) && empty(s + 1)) out.push({ slots: [s, s + 1] });
	}
	return out;
}

/** Spaces (or halves of a tandem space) with nothing in them, for drawing and for "add breaker". */
export function openCells(house: House, panelId: string): Placement[] {
	const panel = house.panels.find((p) => p.id === panelId);
	if (!panel) return [];
	const occ = occupancy(house, panelId);
	const out: Placement[] = [];
	for (let s = 1; s <= panel.spaces; s++) {
		const o = occ.get(s);
		if (!o) out.push({ slots: [s] });
		else if (!o.full && !(o.a && o.b)) out.push({ slots: [s], half: o.a ? 'b' : 'a' });
	}
	return out;
}

/** Highest slot in use, rounded up to an even number: the fewest spaces the panel can shrink to. */
export function minSpaces(house: House, panelId: string): number {
	const max = Math.max(0, ...house.circuits.filter((c) => c.panelId === panelId).flatMap((c) => c.slots));
	return Math.max(2, max + (max % 2));
}

/** Order for 'sequential' numbering: left column top to bottom (240 V across counts here), then right. */
function sequentialKey(c: Circuit): number {
	const col = breakerKind(c) === 'across' || !isRight(c.slots[0]) ? 0 : 1;
	return col * 100000 + rowOf(c.slots[0]) * 10 + (c.half === 'b' ? 1 : 0);
}

/** The number printed on the panel directory for this breaker, e.g. "9", "1/3", "9A" or "S4". */
export function circuitNumber(house: House, c: Circuit): string {
	const p = house.panels.find((x) => x.id === c.panelId);
	const prefix = p?.prefix ?? '';
	if (p?.numbering === 'sequential') {
		const order = house.circuits
			.filter((x) => x.panelId === c.panelId)
			.sort((a, b) => sequentialKey(a) - sequentialKey(b));
		return prefix + (order.findIndex((x) => x.id === c.id) + 1);
	}
	return prefix + (c.half ? `${c.slots[0]}${c.half.toUpperCase()}` : c.slots.join('/'));
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
	return `${p?.short ?? '?'} ${circuitNumber(house, c)}`;
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

/* ---------- Trace images ---------- */

/** Size on the plan, in feet, after rotation. */
export function traceSize(t: TraceImage): { w: number; h: number } {
	const w = t.widthPx * t.ftPerPx,
		h = t.heightPx * t.ftPerPx;
	return t.rotation === 90 || t.rotation === 270 ? { w: h, h: w } : { w, h };
}

/** SVG transform that draws the unrotated image (0,0)–(widthPx·ftPerPx, heightPx·ftPerPx) in its place. */
export function traceTransform(t: TraceImage, offsetY = 0): string {
	const { w, h } = traceSize(t);
	const iw = t.widthPx * t.ftPerPx,
		ih = t.heightPx * t.ftPerPx;
	return `translate(${t.x + w / 2} ${t.y + offsetY + h / 2}) rotate(${t.rotation}) translate(${-iw / 2} ${-ih / 2})`;
}

/** Turn the image 90° clockwise about its center. */
export function rotateTrace(t: TraceImage) {
	const before = traceSize(t);
	const cx = t.x + before.w / 2,
		cy = t.y + before.h / 2;
	t.rotation = ((t.rotation + 90) % 360) as TraceImage['rotation'];
	const after = traceSize(t);
	t.x = cx - after.w / 2;
	t.y = cy - after.h / 2;
}

/** Rescale so two plan points `measured` feet apart become `actual` feet apart, keeping `anchor` fixed. */
export function rescaleTrace(t: TraceImage, measured: number, actual: number, anchor: { x: number; y: number }) {
	if (!(measured > 0) || !(actual > 0)) return;
	const k = actual / measured;
	t.ftPerPx *= k;
	t.x = anchor.x + (t.x - anchor.x) * k;
	t.y = anchor.y + (t.y - anchor.y) * k;
}

/** Union of two boxes. */
export function unionBox(a: Box, b: Box): Box {
	const x = Math.min(a.x, b.x),
		y = Math.min(a.y, b.y);
	return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

const MAX_TRACE_PX = 2000;

/**
 * Read an image file into a TraceImage: shrunk to at most 2000 px on its longest side so it fits in
 * browser storage, and first shown 40 ft wide at the plan origin until the scale is set.
 */
export async function loadTraceImage(file: File): Promise<TraceImage> {
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		const scale = Math.min(1, MAX_TRACE_PX / Math.max(img.naturalWidth, img.naturalHeight));
		const w = Math.round(img.naturalWidth * scale),
			h = Math.round(img.naturalHeight * scale);
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, w, h);
		ctx.drawImage(img, 0, 0, w, h);
		// Line drawings compress best as PNG; photos and scans as JPEG. Keep whichever is smaller.
		const png = canvas.toDataURL('image/png');
		const jpeg = canvas.toDataURL('image/jpeg', 0.85);
		return {
			src: png.length <= jpeg.length ? png : jpeg,
			widthPx: w,
			heightPx: h,
			ftPerPx: 40 / w,
			x: 0,
			y: 0,
			rotation: 0,
			opacity: 0.6,
		};
	} finally {
		URL.revokeObjectURL(url);
	}
}
