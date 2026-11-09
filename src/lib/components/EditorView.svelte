<script lang="ts">
	import {
		cap,
		circuitNumber,
		countsText,
		DEVICE_TYPES,
		findCircuit,
		isFeeder,
		loadTraceImage,
		newId,
		planBounds,
		rescaleTrace,
		roomName,
		roomsText,
		rotateTrace,
		sortedCircuits,
		traceSize,
		TYPE_INFO,
		unionBox,
		type Box,
	} from '../house';
	import { app } from '../state.svelte';
	import type { Device, DeviceType, Room } from '../types';
	import DeviceIcon from './DeviceIcon.svelte';
	import FloorPlan from './FloorPlan.svelte';

	type Tool = 'select' | 'room' | DeviceType | 'trace-move' | 'trace-scale';
	type Point = { x: number; y: number };
	type Selection = { kind: 'device' | 'room'; id: string } | null;
	type Drag = {
		kind: 'device' | 'room' | 'trace';
		id: string;
		dx: number;
		dy: number;
		/** Devices carried along when a room moves, with their offset from the room corner. */
		carried: { d: Device; ox: number; oy: number }[];
	};

	const TOOL_KEYS: Record<string, Tool> = { v: 'select', r: 'room' };
	DEVICE_TYPES.forEach((t, i) => (TOOL_KEYS[String(i + 1)] = t.type));

	const house = $derived(app.house);
	let floorId = $state(app.house.floors[0].id);
	let tool = $state<Tool>('select');
	let selection = $state<Selection>(null);
	let svgEl = $state<SVGSVGElement>();
	let draft = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
	let frozenBox = $state<Box | null>(null);
	let drag: Drag | null = null;

	// Trace image: setting the scale takes two clicks on the plan, then the real distance between them.
	let calib = $state<{ a: Point; b?: Point } | null>(null);
	let pointer = $state<Point | null>(null);
	let calibFeet = $state<number | null>(null);
	let calibInput = $state<HTMLInputElement>();
	let traceFile = $state<HTMLInputElement>();
	let traceMessage = $state('');
	let confirmRemoveTrace = $state(false);

	// Keep the floor valid after an import or a floor delete.
	$effect(() => {
		if (!house.floors.some((f) => f.id === floorId)) floorId = house.floors[0].id;
	});

	const floor = $derived(house.floors.find((f) => f.id === floorId) ?? house.floors[0]);
	// The drawing area stays still while dragging, so the plan doesn't shift under the pointer.
	const box = $derived(frozenBox ?? withTrace(planBounds(house, 8)));
	const trace = $derived(floor.trace);
	const calibMeasured = $derived(calib?.b ? Math.hypot(calib.b.x - calib.a.x, calib.b.y - calib.a.y) : 0);

	/** Grow the drawing area to fit the trace image. */
	function withTrace(b: Box): Box {
		const t = floor.trace;
		if (!t || t.hidden) return b;
		const size = traceSize(t);
		return unionBox(b, { x: t.x - 2, y: t.y - 2, w: size.w + 4, h: size.h + 4 });
	}
	const selDevice = $derived.by(() => {
		const s = selection;
		return s?.kind === 'device' ? house.devices.find((d) => d.id === s.id) : undefined;
	});
	const selRoom = $derived.by(() => {
		const s = selection;
		return s?.kind === 'room' ? house.rooms.find((r) => r.id === s.id) : undefined;
	});
	const floorIsEmpty = $derived(
		!house.rooms.some((r) => r.floorId === floorId) && !house.devices.some((d) => d.floorId === floorId),
	);
	const assignable = $derived(sortedCircuits(house).filter((c) => !isFeeder(house, c.id)));

	const snap = (v: number, step: number) => Math.round(v / step) * step;

	function toPlan(e: PointerEvent) {
		const ctm = svgEl?.getScreenCTM();
		if (!svgEl || !ctm) return { x: 0, y: 0 };
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
		return { x: p.x, y: p.y };
	}

	function capture(e: PointerEvent) {
		frozenBox = box;
		svgEl?.setPointerCapture(e.pointerId);
	}

	function onDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const p = toPlan(e);
		if (tool === 'trace-move') {
			if (trace) {
				drag = { kind: 'trace', id: floorId, dx: trace.x - p.x, dy: trace.y - p.y, carried: [] };
				capture(e);
			}
		} else if (tool === 'trace-scale') {
			if (!calib || calib.b) {
				calib = { a: p };
				calibFeet = null;
			} else {
				calib.b = p;
				queueMicrotask(() => calibInput?.focus());
			}
		} else if (tool === 'room') {
			const x = snap(p.x, 1),
				y = snap(p.y, 1);
			draft = { x0: x, y0: y, x1: x, y1: y };
			capture(e);
		} else if (tool !== 'select') {
			placeDevice(tool, p.x, p.y);
		} else {
			selection = null;
		}
	}

	function onDeviceDown(e: PointerEvent, d: Device) {
		if (tool !== 'select' || e.button !== 0) return;
		e.stopPropagation();
		selection = { kind: 'device', id: d.id };
		const p = toPlan(e);
		drag = { kind: 'device', id: d.id, dx: d.x - p.x, dy: d.y - p.y, carried: [] };
		capture(e);
	}

	function onRoomDown(e: PointerEvent, r: Room) {
		if (tool !== 'select' || e.button !== 0) return;
		e.stopPropagation();
		selection = { kind: 'room', id: r.id };
		const p = toPlan(e);
		const carried = house.devices
			.filter((d) => d.floorId === r.floorId && d.x >= r.x && d.x <= r.x + r.w && d.y >= r.y && d.y <= r.y + r.h)
			.map((d) => ({ d, ox: d.x - r.x, oy: d.y - r.y }));
		drag = { kind: 'room', id: r.id, dx: r.x - p.x, dy: r.y - p.y, carried };
		capture(e);
	}

	function onMove(e: PointerEvent) {
		if (tool === 'trace-scale') pointer = toPlan(e);
		if (!draft && !drag) return;
		const p = toPlan(e);
		if (drag?.kind === 'trace') {
			if (trace) {
				trace.x = Math.round((p.x + drag.dx) * 20) / 20;
				trace.y = Math.round((p.y + drag.dy) * 20) / 20;
			}
		} else if (draft) {
			draft.x1 = snap(p.x, 1);
			draft.y1 = snap(p.y, 1);
		} else if (drag?.kind === 'device') {
			const d = house.devices.find((x) => x.id === drag!.id);
			if (d) {
				d.x = snap(p.x + drag.dx, 0.5);
				d.y = snap(p.y + drag.dy, 0.5);
			}
		} else if (drag?.kind === 'room') {
			const r = house.rooms.find((x) => x.id === drag!.id);
			if (r) {
				r.x = snap(p.x + drag.dx, 1);
				r.y = snap(p.y + drag.dy, 1);
				for (const c of drag.carried) {
					c.d.x = r.x + c.ox;
					c.d.y = r.y + c.oy;
				}
			}
		}
	}

	function onUp() {
		if (draft) {
			const x = Math.min(draft.x0, draft.x1),
				y = Math.min(draft.y0, draft.y1);
			const w = Math.abs(draft.x1 - draft.x0),
				h = Math.abs(draft.y1 - draft.y0);
			if (w >= 2 && h >= 2) {
				const n = house.rooms.filter((r) => r.floorId === floorId).length + 1;
				const room: Room = { id: newId('r'), floorId, name: `Room ${n}`, x, y, w, h };
				house.rooms.push(room);
				selection = { kind: 'room', id: room.id };
				tool = 'select';
			}
			draft = null;
		}
		drag = null;
		frozenBox = null;
	}

	function placeDevice(type: DeviceType, x: number, y: number) {
		const d: Device = {
			id: newId('d'),
			floorId,
			type,
			circuitId: app.lastCircuit,
			x: snap(x, 0.5),
			y: snap(y, 0.5),
			label: type === 'appl' ? 'Appliance' : '',
		};
		house.devices.push(d);
		selection = { kind: 'device', id: d.id };
	}

	function deleteSelection() {
		const s = selection;
		if (!s) return;
		if (s.kind === 'device') house.devices = house.devices.filter((d) => d.id !== s.id);
		else house.rooms = house.rooms.filter((r) => r.id !== s.id);
		selection = null;
	}

	function setCircuit(d: Device, value: string) {
		d.circuitId = value || null;
		app.lastCircuit = d.circuitId;
	}

	function setRoomNumber(r: Room, key: 'x' | 'y' | 'w' | 'h', value: number) {
		if (!Number.isFinite(value)) return;
		r[key] = key === 'w' || key === 'h' ? Math.max(1, value) : value;
	}

	function switchFloor(id: string) {
		floorId = id;
		selection = null;
		calib = null;
		confirmRemoveTrace = false;
		traceMessage = '';
		if (tool === 'trace-move' || tool === 'trace-scale') tool = 'select';
	}

	async function addTrace(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		try {
			const t = await loadTraceImage(file);
			const b = planBounds(house, 0);
			// Start at the corner of whatever is already drawn (or the origin on an empty plan).
			if (house.rooms.length) {
				t.x = Math.round(b.x);
				t.y = Math.round(b.y);
			}
			floor.trace = t;
			confirmRemoveTrace = false;
			startScale();
		} catch {
			traceMessage = `Couldn't read ${file.name} as an image. Try a PNG or JPEG.`;
		}
	}

	function startScale() {
		tool = 'trace-scale';
		calib = null;
		calibFeet = null;
		traceMessage = '';
	}

	function applyScale() {
		if (!trace || !calib?.b || !calibFeet || calibFeet <= 0 || calibMeasured <= 0) return;
		rescaleTrace(trace, calibMeasured, calibFeet, calib.a);
		traceMessage = `Scale set: those points are now ${calibFeet} ft apart. Drag the image to line it up with the grid.`;
		calib = null;
		tool = 'trace-move';
	}

	function removeTrace() {
		delete floor.trace;
		confirmRemoveTrace = false;
		calib = null;
		traceMessage = '';
		if (tool === 'trace-move' || tool === 'trace-scale') tool = 'select';
	}

	function addFloor() {
		const n = house.floors.length + 1;
		const f = { id: newId('f'), name: `Floor ${n}`, short: `F${n}` };
		house.floors.push(f);
		switchFloor(f.id);
	}

	function deleteFloor() {
		if (!floorIsEmpty || house.floors.length < 2) return;
		const id = floorId;
		house.floors = house.floors.filter((f) => f.id !== id);
		if (app.floorView === id) app.floorView = house.floors[0].id;
		switchFloor(house.floors[0].id);
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('input, select, textarea')) return;
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			deleteSelection();
		} else if (e.key === 'Escape') {
			tool = 'select';
			selection = null;
			draft = null;
			calib = null;
		} else if (!e.ctrlKey && !e.metaKey && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) {
			tool = TOOL_KEYS[e.key.toLowerCase()];
		}
	}

	const siblings = $derived(
		selDevice?.circuitId ? house.devices.filter((d) => d.circuitId === selDevice.circuitId && d.id !== selDevice.id) : [],
	);
</script>

<svelte:window onkeydown={onKey} />

<div class="editor">
	<div class="tools" role="toolbar" aria-label="Drawing tools">
		<h3>Draw</h3>
		<button type="button" class="tool" class:active={tool === 'select'} onclick={() => (tool = 'select')}>
			Select / move<kbd>V</kbd>
		</button>
		<button type="button" class="tool" class:active={tool === 'room'} onclick={() => (tool = 'room')}>
			Room<kbd>R</kbd>
		</button>
		<h3>Place</h3>
		{#each DEVICE_TYPES as t, i (t.type)}
			<button type="button" class="tool" class:active={tool === t.type} onclick={() => (tool = t.type)}>
				<DeviceIcon type={t.type} />{t.type === 'gfci' ? 'GFCI' : cap(t.name)}<kbd>{i + 1}</kbd>
			</button>
		{/each}
	</div>

	<div class="card">
		<div class="canvas-bar">
			<div class="floorbar" role="group" aria-label="Floor to edit">
				{#each house.floors as f (f.id)}
					<button type="button" class="ftab" aria-pressed={f.id === floorId} onclick={() => switchFloor(f.id)}>{f.name}</button>
				{/each}
				<button type="button" class="ftab add" onclick={addFloor}>+ Add floor</button>
			</div>
		</div>
		<div class="canvas-bar">
			<label class="note" for="floor-name">Floor name</label>
			<input id="floor-name" type="text" value={floor.name} oninput={(e) => (floor.name = e.currentTarget.value)} />
			<label class="note" for="floor-short">Short</label>
			<input id="floor-short" type="text" style="width:5em" value={floor.short} oninput={(e) => (floor.short = e.currentTarget.value)} />
			<button
				type="button"
				class="btn danger"
				disabled={!floorIsEmpty || house.floors.length < 2}
				title={floorIsEmpty ? 'Delete this floor' : 'Remove its rooms and devices first'}
				onclick={deleteFloor}>Delete floor</button
			>
			<span class="note" style="margin-left:auto">Grid 1 ft · rooms snap to 1 ft, devices to 6 in</span>
		</div>

			<div class="trace-bar">
				<input bind:this={traceFile} type="file" accept="image/*" hidden onchange={addTrace} />
				{#if !trace}
					<button type="button" class="btn" onclick={() => traceFile?.click()}>Add floor plan image…</button>
					<span class="note">Trace over a picture of this floor: a sketch, a scan or a photo of the plans.</span>
				{:else}
					{@const size = traceSize(trace)}
					<strong>Trace image</strong>
					<span class="note">{size.w.toFixed(1)}′ × {size.h.toFixed(1)}′</span>
					<button type="button" class="btn" aria-pressed={tool === 'trace-scale'} onclick={startScale}>Set scale</button>
					<button
						type="button"
						class="btn"
						aria-pressed={tool === 'trace-move'}
						onclick={() => (tool = tool === 'trace-move' ? 'select' : 'trace-move')}>Move image</button
					>
					<button type="button" class="btn" onclick={() => rotateTrace(trace)}>Rotate 90°</button>
					<label class="note" for="trace-opacity">Opacity</label>
					<input
						id="trace-opacity"
						type="range"
						min="0.1"
						max="1"
						step="0.05"
						value={trace.opacity}
						oninput={(e) => (trace.opacity = e.currentTarget.valueAsNumber)}
					/>
					<button type="button" class="btn" onclick={() => (trace.hidden = !trace.hidden)}>
						{trace.hidden ? 'Show' : 'Hide'}
					</button>
					<button type="button" class="btn" onclick={() => traceFile?.click()}>Replace…</button>
					{#if confirmRemoveTrace}
						<span>Remove the image from this floor?</span>
						<button type="button" class="btn danger" onclick={removeTrace}>Remove</button>
						<button type="button" class="btn" onclick={() => (confirmRemoveTrace = false)}>Cancel</button>
					{:else}
						<button type="button" class="btn danger" onclick={() => (confirmRemoveTrace = true)}>Remove</button>
					{/if}
				{/if}
			</div>
			{#if tool === 'trace-scale' && calib?.b}
				<form
					class="trace-bar"
					onsubmit={(e) => {
						e.preventDefault();
						applyScale();
					}}
				>
					<label for="calib-feet">Real distance between the two points</label>
					<input
						id="calib-feet"
						type="number"
						min="0.1"
						step="any"
						bind:this={calibInput}
						bind:value={calibFeet}
					/>
					<span>ft</span>
					<span class="note">(currently {calibMeasured.toFixed(1)} ft)</span>
					<button type="submit" class="btn" disabled={!calibFeet || calibFeet <= 0}>Apply</button>
					<button type="button" class="btn" onclick={() => (calib = null)}>Start over</button>
				</form>
			{/if}
			{#if traceMessage}<p class="note" role="status">{traceMessage}</p>{/if}

		<div class="plan-scroll">
			<FloorPlan
				{house}
				floorIds={[floorId]}
				{box}
				grid
				showTrace
				label="Editable floor plan for {floor.name}"
				selectedId={selection?.id ?? null}
				bind:svgEl
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				ondevicedown={onDeviceDown}
				ondeviceclick={(d) => tool === 'select' && (selection = { kind: 'device', id: d.id })}
				onroomdown={onRoomDown}
			>
				{#snippet overlay()}
					{#if draft}
						{@const x = Math.min(draft.x0, draft.x1)}
						{@const y = Math.min(draft.y0, draft.y1)}
						{@const w = Math.abs(draft.x1 - draft.x0)}
						{@const h = Math.abs(draft.y1 - draft.y0)}
						<rect class="draft" {x} {y} width={w} height={h} />
						<text class="draft-t" x={x + w / 2} y={y + h / 2}>{w}′ × {h}′</text>
					{/if}
					{#if tool === 'trace-scale' && calib}
						{@const end = calib.b ?? pointer}
						{#if end}
							<line class="calib-line" x1={calib.a.x} y1={calib.a.y} x2={end.x} y2={end.y} />
						{/if}
						<circle class="calib-dot" cx={calib.a.x} cy={calib.a.y} r=".3" />
						{#if calib.b}<circle class="calib-dot" cx={calib.b.x} cy={calib.b.y} r=".3" />{/if}
					{/if}
				{/snippet}
			</FloorPlan>
		</div>
		<p class="note">
			{#if tool === 'trace-scale'}
				{#if !calib}Click one end of a wall whose length you know, such as an outside wall with a dimension on it.
				{:else if !calib.b}Now click the other end of that wall.
				{:else}Type the real length of that wall and press Apply.{/if}
			{:else if tool === 'trace-move'}Drag the image to line its walls up with the grid. Press Esc when done.
			{:else if tool === 'room'}Drag on the grid to draw a room. Draw over the walls in the image to trace it.
			{:else if tool !== 'select'}Click to place a {TYPE_INFO[tool].name}. New devices go on the last circuit you picked.
			{:else}Click a room or device to select it; drag to move it. Moving a room moves the devices inside it. Delete removes the selection.{/if}
		</p>
	</div>

	<div class="props">
		{#if selDevice}
			{@const d = selDevice}
			<h3>Device</h3>
			<div class="field">
				<label for="p-type">Type</label>
				<select id="p-type" value={d.type} onchange={(e) => (d.type = e.currentTarget.value as DeviceType)}>
					{#each DEVICE_TYPES as t (t.type)}<option value={t.type}>{cap(t.name)}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="p-circuit">Circuit</label>
				<select id="p-circuit" value={d.circuitId ?? ''} onchange={(e) => setCircuit(d, e.currentTarget.value)}>
					<option value="">No circuit yet</option>
					{#each house.panels as p (p.id)}
						<optgroup label={p.name}>
							{#each assignable.filter((c) => c.panelId === p.id) as c (c.id)}
								<option value={c.id}>{circuitNumber(house, c)} · {c.label} ({c.amps} A)</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="p-label">{d.type === 'appl' ? 'Appliance name' : 'Note'}</label>
				<input id="p-label" type="text" value={d.label} oninput={(e) => (d.label = e.currentTarget.value)} />
			</div>
			<div class="field">
				<span class="k">Floor · room</span>
				<output>{house.floors.find((f) => f.id === d.floorId)?.name} · {roomName(house, d)}</output>
			</div>
			<div class="field">
				<span class="k">Position</span>
				<output>x {d.x} ft, y {d.y} ft</output>
			</div>
			<h3>Also on this circuit</h3>
			<div class="sibs">
				{#if !findCircuit(house, d.circuitId)}Pick a circuit to see what else is on it.
				{:else if siblings.length}{countsText(siblings)}<br />in {roomsText(house, siblings)}
				{:else}Nothing else yet.{/if}
			</div>
			<button type="button" class="btn danger" onclick={deleteSelection}>Delete device</button>
		{:else if selRoom}
			{@const r = selRoom}
			<h3>Room</h3>
			<div class="field">
				<label for="r-name">Name</label>
				<input id="r-name" type="text" value={r.name} oninput={(e) => (r.name = e.currentTarget.value)} />
			</div>
			<div class="grid4">
				{#each ['x', 'y', 'w', 'h'] as const as k (k)}
					<div class="field">
						<label for="r-{k}">{k === 'w' ? 'Width' : k === 'h' ? 'Depth' : k.toUpperCase()}</label>
						<input
							id="r-{k}"
							type="number"
							step="1"
							value={r[k]}
							onchange={(e) => setRoomNumber(r, k, e.currentTarget.valueAsNumber)}
						/>
					</div>
				{/each}
			</div>
			<p class="note">Feet. Devices inside the room stay where they are when you delete it.</p>
			<button type="button" class="btn danger" onclick={deleteSelection}>Delete room</button>
		{:else}
			<h3>Nothing selected</h3>
			<p class="note">
				Draw rooms with the Room tool, then place devices and pick a circuit for each. Everything saves in this browser as
				you go; use Export to keep a copy.
			</p>
			<p class="note">Add or change breakers on the Panels tab.</p>
		{/if}
	</div>
</div>
