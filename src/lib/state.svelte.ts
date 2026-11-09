import { expandCircuit } from './house';
import { sampleHouse } from './sample';
import type { House } from './types';

const STORAGE_KEY = 'panel-circuit-map:house:v1';

export type View = 'map' | 'detail' | 'editor' | 'panels';
export const VIEWS: View[] = ['map', 'detail', 'editor', 'panels'];

export function isHouse(value: unknown): value is House {
	const h = value as House;
	return (
		!!h &&
		h.version === 1 &&
		Array.isArray(h.panels) &&
		Array.isArray(h.circuits) &&
		Array.isArray(h.floors) &&
		h.floors.length > 0 &&
		Array.isArray(h.rooms) &&
		Array.isArray(h.devices)
	);
}

function load(): House {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed: unknown = JSON.parse(raw);
			if (isHouse(parsed)) return parsed;
		}
	} catch {
		// Fall through to the sample house.
	}
	return sampleHouse();
}

class AppState {
	house = $state<House>(load());
	view = $state<View>('map');

	/** Circuit under the pointer (breaker or device). */
	hover = $state<string | null>(null);
	/** Device under the pointer, if the hover came from the plan. */
	hoverDevice = $state<string | null>(null);
	/** Circuit pinned by a click. */
	pinned = $state<string | null>(null);

	/** Floor id shown on the map, or 'all' for every floor stacked. */
	floorView = $state<string>(this.house.floors[0]?.id ?? 'all');
	/** Circuit given to newly placed devices. */
	lastCircuit = $state<string | null>(null);
	/** Set when the last save to browser storage failed (usually because it is full). */
	saveError = $state('');

	active = $derived(this.hover ?? this.pinned);
	activeSet = $derived(this.active ? expandCircuit(this.house, this.active) : new Set<string>());

	hoverCircuit(circuitId: string | null, deviceId: string | null = null) {
		this.hover = circuitId;
		this.hoverDevice = deviceId;
	}

	clearHover() {
		this.hover = null;
		this.hoverDevice = null;
	}

	togglePin(circuitId: string) {
		this.pinned = this.pinned === circuitId ? null : circuitId;
		this.followPin();
	}

	pin(circuitId: string) {
		this.pinned = circuitId;
		this.followPin();
	}

	unpin() {
		this.pinned = null;
	}

	/** If the pinned circuit has nothing on the floor being shown, switch to the floor with the most. */
	followPin() {
		if (!this.pinned || this.floorView === 'all') return;
		const set = expandCircuit(this.house, this.pinned);
		const devices = this.house.devices.filter((d) => d.circuitId && set.has(d.circuitId));
		if (!devices.length || devices.some((d) => d.floorId === this.floorView)) return;
		const best = this.house.floors
			.map((f) => ({ id: f.id, n: devices.filter((d) => d.floorId === f.id).length }))
			.sort((a, b) => b.n - a.n)[0];
		this.floorView = best.id;
	}

	/** Remove a circuit; its devices become unassigned and any panel it fed loses its feeder. */
	deleteCircuit(circuitId: string) {
		const h = this.house;
		h.circuits = h.circuits.filter((c) => c.id !== circuitId);
		for (const d of h.devices) if (d.circuitId === circuitId) d.circuitId = null;
		for (const p of h.panels) if (p.fedBy === circuitId) delete p.fedBy;
		if (this.pinned === circuitId) this.pinned = null;
		if (this.hover === circuitId) this.clearHover();
		if (this.lastCircuit === circuitId) this.lastCircuit = null;
	}

	/** Remove an empty panel (callers make sure it has no circuits). */
	deletePanel(panelId: string) {
		if (this.house.circuits.some((c) => c.panelId === panelId)) return;
		this.house.panels = this.house.panels.filter((p) => p.id !== panelId);
	}

	replaceHouse(house: House) {
		this.house = house;
		this.pinned = null;
		this.clearHover();
		this.lastCircuit = null;
		this.floorView = house.floors[0]?.id ?? 'all';
	}

	resetToSample() {
		this.replaceHouse(sampleHouse());
	}
}

export const app = new AppState();

// Save every change to this browser.
$effect.root(() => {
	$effect(() => {
		const json = JSON.stringify(app.house);
		try {
			localStorage.setItem(STORAGE_KEY, json);
			if (app.saveError) app.saveError = '';
		} catch {
			app.saveError = `Couldn't save in this browser: storage is full (${Math.round(json.length / 1024)} KB). Export to keep a copy, or remove a trace image.`;
		}
	});
});
