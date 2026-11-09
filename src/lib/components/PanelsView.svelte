<script lang="ts">
	import {
		BREAKER_KINDS,
		breakerKind,
		circuitNumber,
		circuitRef,
		countsText,
		expandCircuit,
		feederOptions,
		isFeeder,
		minSpaces,
		newId,
		placementKey,
		placementLabel,
		roomsText,
		validPlacements,
		type BreakerKind,
		type Placement,
	} from '../house';
	import { app } from '../state.svelte';
	import type { Circuit, Panel, Protection } from '../types';
	import PanelBoard from './PanelBoard.svelte';

	type Selection = { kind: 'panel' | 'circuit'; id: string } | null;

	const COMMON_AMPS = [15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 200];
	const PROTECTIONS: { value: Protection; name: string }[] = [
		{ value: '', name: 'Standard' },
		{ value: 'GFCI', name: 'GFCI' },
		{ value: 'AFCI', name: 'AFCI' },
		{ value: 'DUAL', name: 'Dual function (AFCI + GFCI)' },
	];
	const MAX_SPACES = 84;

	const house = $derived(app.house);
	let selection = $state<Selection>(null);
	let confirmDelete = $state(false);
	let error = $state('');
	let focusLabel = $state(false);
	let labelInput = $state<HTMLInputElement>();

	const selPanel = $derived.by(() => {
		const s = selection;
		return s?.kind === 'panel' ? house.panels.find((p) => p.id === s.id) : undefined;
	});
	const selCircuit = $derived.by(() => {
		const s = selection;
		return s?.kind === 'circuit' ? house.circuits.find((c) => c.id === s.id) : undefined;
	});

	// Put the cursor in the label field after adding a breaker, so you can type its name straight away.
	$effect(() => {
		if (focusLabel && labelInput) {
			labelInput.focus();
			labelInput.select();
			focusLabel = false;
		}
	});

	function select(s: Selection) {
		selection = s;
		confirmDelete = false;
		error = '';
	}

	function addCircuit(p: Panel, at: Placement) {
		const c: Circuit = { id: newId('c'), panelId: p.id, slots: at.slots, amps: 15, label: 'New circuit', protection: '' };
		if (at.half) c.half = at.half;
		house.circuits.push(c);
		select({ kind: 'circuit', id: c.id });
		focusLabel = true;
	}

	function addPanel() {
		const n = house.panels.length + 1;
		const p: Panel = { id: newId('p'), name: `Panel ${n}`, short: `P${n}`, rating: '', spaces: 20, location: '' };
		house.panels.push(p);
		select({ kind: 'panel', id: p.id });
	}

	function place(c: Circuit, at: Placement) {
		c.slots = at.slots;
		if (at.half) c.half = at.half;
		else delete c.half;
	}

	const KIND_NEEDS: Partial<Record<BreakerKind, string>> = {
		stacked: 'the space below it on the same side to be free',
		across: 'the space beside it in the same row to be free, starting from the left side',
	};

	/** Change breaker type, keeping it where it is when the new shape fits there. */
	function setKind(c: Circuit, kind: BreakerKind) {
		if (kind === breakerKind(c)) return;
		const fits = validPlacements(house, c.panelId, kind, c.id).filter((p) => p.slots[0] === c.slots[0]);
		if (fits.length) {
			place(c, fits.find((p) => p.half === (c.half ?? 'a')) ?? fits[0]);
			error = '';
		} else {
			const need = KIND_NEEDS[kind];
			error = need ? `That needs ${need}. Move this breaker first.` : "That doesn't fit here. Move this breaker first.";
		}
	}

	function setPanel(c: Circuit, panelId: string) {
		const spots = validPlacements(house, panelId, breakerKind(c));
		if (!spots.length) {
			error = 'That panel has no open space for this breaker.';
			return;
		}
		c.panelId = panelId;
		place(c, spots[0]);
		error = '';
	}

	function setPosition(c: Circuit, key: string) {
		const at = validPlacements(house, c.panelId, breakerKind(c), c.id).find((p) => placementKey(p) === key);
		if (at) place(c, at);
	}

	function setSpaces(p: Panel, input: HTMLInputElement) {
		const value = input.valueAsNumber;
		const min = minSpaces(house, p.id);
		if (Number.isFinite(value)) {
			let n = Math.round(value);
			if (n % 2) n += 1;
			p.spaces = Math.min(MAX_SPACES, Math.max(min, n));
			error = value < min ? `Breakers use spaces up to ${min}, so the panel can't have fewer.` : '';
		}
		// Show the value actually kept, even when it didn't change.
		input.value = String(p.spaces);
	}

	function setAmps(c: Circuit, input: HTMLInputElement) {
		const v = input.valueAsNumber;
		if (Number.isFinite(v) && v > 0) c.amps = v;
		input.value = String(c.amps);
	}

	function setFedBy(p: Panel, value: string) {
		if (value) p.fedBy = value;
		else delete p.fedBy;
	}

	function setMarkerFloor(p: Panel, floorId: string) {
		if (!floorId) delete p.marker;
		else p.marker = { floorId, x: p.marker?.x ?? 0, y: p.marker?.y ?? 0 };
	}

	function setMarkerCoord(p: Panel, key: 'x' | 'y', value: number) {
		if (p.marker && Number.isFinite(value)) p.marker[key] = value;
	}

	function deleteCircuit(c: Circuit) {
		app.deleteCircuit(c.id);
		select(null);
	}

	function deletePanel(p: Panel) {
		app.deletePanel(p.id);
		select(null);
	}

	function showOnMap(c: Circuit) {
		app.view = 'map';
		app.pin(c.id);
	}

	const devicesOn = (c: Circuit) => house.devices.filter((d) => d.circuitId === c.id);
	const fedPanels = (c: Circuit) => house.panels.filter((p) => p.fedBy === c.id);
</script>

<div class="panels-edit">
	<div class="panels-col">
		<PanelBoard
			mode="edit"
			selectedId={selection?.id ?? null}
			onselectcircuit={(c) => select({ kind: 'circuit', id: c.id })}
			onselectpanel={(p) => select({ kind: 'panel', id: p.id })}
			onaddcircuit={addCircuit}
		/>
		<button type="button" class="btn" style="align-self:flex-start" onclick={addPanel}>+ Add panel</button>
	</div>

	<div class="props">
		{#if selCircuit}
			{@const c = selCircuit}
			{@const devices = devicesOn(c)}
			{@const fed = fedPanels(c)}
			<h3>Breaker · {circuitRef(house, c)}</h3>
			<div class="field">
				<label for="c-label">Label</label>
				<input
					id="c-label"
					type="text"
					bind:this={labelInput}
					value={c.label}
					oninput={(e) => (c.label = e.currentTarget.value)}
				/>
			</div>
			<div class="grid2">
				<div class="field">
					<label for="c-amps">Amps</label>
					<input
						id="c-amps"
						type="number"
						min="10"
						max="400"
						step="5"
						list="amp-sizes"
						value={c.amps}
						onchange={(e) => setAmps(c, e.currentTarget)}
					/>
					<datalist id="amp-sizes">
						{#each COMMON_AMPS as a (a)}<option value={a}></option>{/each}
					</datalist>
				</div>
				<div class="field">
					<span class="k">Voltage</span>
					<output>{c.slots.length > 1 ? '240 V, double-pole' : '120 V'}</output>
				</div>
			</div>
			<div class="field">
				<span class="k">Breaker type</span>
				<div class="seg wrap" role="group" aria-label="Breaker type">
					{#each BREAKER_KINDS as k (k.kind)}
						<button type="button" aria-pressed={breakerKind(c) === k.kind} onclick={() => setKind(c, k.kind)}>{k.name}</button>
					{/each}
				</div>
			</div>
			<div class="grid2">
				<div class="field">
					<label for="c-panel">Panel</label>
					<select id="c-panel" value={c.panelId} onchange={(e) => setPanel(c, e.currentTarget.value)}>
						{#each house.panels as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="c-slot">Position</label>
					<select id="c-slot" value={placementKey(c)} onchange={(e) => setPosition(c, e.currentTarget.value)}>
						{#each validPlacements(house, c.panelId, breakerKind(c), c.id) as at (placementKey(at))}
							<option value={placementKey(at)}>{placementLabel(at)}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="field">
				<label for="c-prot">Protection</label>
				<select id="c-prot" value={c.protection} onchange={(e) => (c.protection = e.currentTarget.value as Protection)}>
					{#each PROTECTIONS as p (p.value)}<option value={p.value}>{p.name}</option>{/each}
				</select>
			</div>
			{#if error}<p class="err" role="alert">{error}</p>{/if}

			<h3>On this breaker</h3>
			<p class="note">
				{#if fed.length}Feeds {fed.map((p) => p.name).join(', ')} ({expandCircuit(house, c.id).size - 1} circuits).{/if}
				{#if devices.length}{countsText(devices)} in {roomsText(house, devices)}.
				{:else if !fed.length}No devices yet. Assign them in the plan editor.{/if}
			</p>

			{#if confirmDelete}
				<div class="confirm" role="alert">
					<span>
						Delete this breaker?
						{#if devices.length}Its {devices.length} devices will have no circuit.{/if}
						{#if fed.length}{fed.map((p) => p.name).join(', ')} will have no feeder.{/if}
					</span>
					<button type="button" class="btn danger" onclick={() => deleteCircuit(c)}>Delete</button>
					<button type="button" class="btn" onclick={() => (confirmDelete = false)}>Cancel</button>
				</div>
			{:else}
				<div class="row-actions">
					<button type="button" class="btn" onclick={() => showOnMap(c)}>Show on map</button>
					<button type="button" class="btn danger" onclick={() => (confirmDelete = true)}>Delete breaker</button>
				</div>
			{/if}
		{:else if selPanel}
			{@const p = selPanel}
			{@const count = house.circuits.filter((c) => c.panelId === p.id).length}
			<h3>Panel</h3>
			<div class="grid2">
				<div class="field">
					<label for="p-name">Name</label>
					<input id="p-name" type="text" value={p.name} oninput={(e) => (p.name = e.currentTarget.value)} />
				</div>
				<div class="field">
					<label for="p-short">Short name</label>
					<input id="p-short" type="text" value={p.short} oninput={(e) => (p.short = e.currentTarget.value)} />
				</div>
			</div>
			<div class="grid2">
				<div class="field">
					<label for="p-rating">Rating</label>
					<input
						id="p-rating"
						type="text"
						placeholder="e.g. 200 A main"
						value={p.rating}
						oninput={(e) => (p.rating = e.currentTarget.value)}
					/>
				</div>
				<div class="field">
					<label for="p-spaces">Spaces</label>
					<input
						id="p-spaces"
						type="number"
						min={minSpaces(house, p.id)}
						max={MAX_SPACES}
						step="2"
						value={p.spaces}
						onchange={(e) => setSpaces(p, e.currentTarget)}
					/>
				</div>
			</div>
			<div class="grid2">
				<div class="field">
					<label for="p-numbering">Numbering</label>
					<select
						id="p-numbering"
						value={p.numbering ?? 'odd-even'}
						onchange={(e) => (p.numbering = e.currentTarget.value as 'odd-even' | 'sequential')}
					>
						<option value="odd-even">Odd left, even right</option>
						<option value="sequential">Down the left, then the right</option>
					</select>
				</div>
				<div class="field">
					<label for="p-prefix">Number prefix</label>
					<input
						id="p-prefix"
						type="text"
						placeholder="e.g. S"
						value={p.prefix ?? ''}
						oninput={(e) => (p.prefix = e.currentTarget.value)}
					/>
				</div>
			</div>
			<div class="field">
				<label for="p-loc">Location</label>
				<input
					id="p-loc"
					type="text"
					placeholder="e.g. Garage, west wall"
					value={p.location}
					oninput={(e) => (p.location = e.currentTarget.value)}
				/>
			</div>
			<div class="field">
				<label for="p-fed">Fed by</label>
				<select id="p-fed" value={p.fedBy ?? ''} onchange={(e) => setFedBy(p, e.currentTarget.value)}>
					<option value="">Utility service (main panel)</option>
					{#each house.panels.filter((x) => x.id !== p.id) as other (other.id)}
						<optgroup label={other.name}>
							{#each feederOptions(house, p.id).filter((c) => c.panelId === other.id) as c (c.id)}
								<option value={c.id}>{circuitNumber(house, c)} · {c.label} ({c.amps} A)</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="p-mfloor">Shown on floor plan</label>
				<select id="p-mfloor" value={p.marker?.floorId ?? ''} onchange={(e) => setMarkerFloor(p, e.currentTarget.value)}>
					<option value="">Not shown</option>
					{#each house.floors as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
				</select>
			</div>
			{#if p.marker}
				<div class="grid2">
					{#each ['x', 'y'] as const as k (k)}
						<div class="field">
							<label for="p-m{k}">{k.toUpperCase()} (ft)</label>
							<input
								id="p-m{k}"
								type="number"
								step="0.5"
								value={p.marker[k]}
								onchange={(e) => setMarkerCoord(p, k, e.currentTarget.valueAsNumber)}
							/>
						</div>
					{/each}
				</div>
			{/if}
			{#if error}<p class="err" role="alert">{error}</p>{/if}
			<button
				type="button"
				class="btn danger"
				style="align-self:flex-start"
				disabled={count > 0}
				title={count ? 'Delete or move its breakers first' : 'Delete this panel'}
				onclick={() => deletePanel(p)}>Delete panel</button
			>
			{#if count}<p class="note">Delete or move its {count} breakers before deleting the panel.</p>{/if}
		{:else}
			<h3>Panels and breakers</h3>
			<p class="note">Click a breaker to edit it, an open space to add a breaker there, or a panel's name to edit the panel.</p>
			<p class="note">
				A 240 V breaker takes two spaces: stacked on one side, or across both sides of one row, depending on the
				panel. Tandem breakers fit two circuits in one space. Subpanels are linked to the breaker that feeds them,
				so tracing that breaker on the map lights up everything in the subpanel.
			</p>
			{#if house.circuits.some((c) => isFeeder(house, c.id))}
				<p class="note">
					Feeders: {house.circuits
						.filter((c) => isFeeder(house, c.id))
						.map((c) => `${circuitRef(house, c)} → ${fedPanels(c).map((p) => p.name).join(', ')}`)
						.join(' · ')}
				</p>
			{/if}
		{/if}
	</div>
</div>
