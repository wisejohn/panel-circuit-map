<script lang="ts">
	import {
		circuitRef,
		countsText,
		expandCircuit,
		feederOptions,
		isFeeder,
		minSpaces,
		newId,
		roomsText,
		slotsFor,
		validStarts,
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

	function addCircuit(p: Panel, slot: number) {
		const c: Circuit = { id: newId('c'), panelId: p.id, slots: [slot], amps: 15, label: 'New circuit', protection: '' };
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

	function setPoles(c: Circuit, poles: number) {
		if (poles === c.slots.length) return;
		if (validStarts(house, c.panelId, poles, c.id).includes(c.slots[0])) {
			c.slots = slotsFor(c.slots[0], poles);
			error = '';
		} else {
			const need = slotsFor(c.slots[0], poles).filter((s) => s !== c.slots[0]);
			error = `Space ${need.join(', ')} is taken or past the end of the panel. Move this breaker to a spot with a free space below it first.`;
		}
	}

	function setPanel(c: Circuit, panelId: string) {
		const starts = validStarts(house, panelId, c.slots.length);
		if (!starts.length) {
			error = 'That panel has no open space for this breaker.';
			return;
		}
		c.panelId = panelId;
		c.slots = slotsFor(starts[0], c.slots.length);
		error = '';
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
					<span class="k">Poles</span>
					<div class="seg" role="group" aria-label="Poles">
						<button type="button" aria-pressed={c.slots.length === 1} onclick={() => setPoles(c, 1)}>1 · 120 V</button>
						<button type="button" aria-pressed={c.slots.length === 2} onclick={() => setPoles(c, 2)}>2 · 240 V</button>
					</div>
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
					<select
						id="c-slot"
						value={c.slots[0]}
						onchange={(e) => (c.slots = slotsFor(Number(e.currentTarget.value), c.slots.length))}
					>
						{#each validStarts(house, c.panelId, c.slots.length, c.id) as s (s)}
							<option value={s}>Space {slotsFor(s, c.slots.length).join(' + ')} ({s % 2 ? 'left' : 'right'})</option>
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
								<option value={c.id}>{c.slots.join('/')} · {c.label} ({c.amps} A)</option>
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
				A double-pole (240 V) breaker takes two spaces on the same side, like 1 and 3. Subpanels are linked to the
				breaker that feeds them, so tracing that breaker on the map lights up everything in the subpanel.
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
