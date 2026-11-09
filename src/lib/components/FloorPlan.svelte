<script lang="ts">
	import type { Snippet } from 'svelte';
	import { applianceCode, circuitRef, deviceName, findCircuit, planBounds, roomName, type Box } from '../house';
	import type { Device, House, Room } from '../types';
	import DeviceSymbol from './DeviceSymbol.svelte';

	interface Props {
		house: House;
		floorIds: string[];
		/** Fixed drawing area; defaults to the bounds of the whole house. */
		box?: Box;
		grid?: boolean;
		dim?: boolean;
		litDevices?: Set<string>;
		litRooms?: Set<string>;
		focusId?: string | null;
		selectedId?: string | null;
		label: string;
		svgEl?: SVGSVGElement;
		overlay?: Snippet;
		ondeviceenter?: (d: Device) => void;
		ondeviceleave?: (d: Device) => void;
		ondeviceclick?: (d: Device) => void;
		ondevicedown?: (e: PointerEvent, d: Device) => void;
		onroomdown?: (e: PointerEvent, r: Room) => void;
		onpointerdown?: (e: PointerEvent) => void;
		onpointermove?: (e: PointerEvent) => void;
		onpointerup?: (e: PointerEvent) => void;
		onbackgroundclick?: () => void;
	}

	let {
		house,
		floorIds,
		box,
		grid = false,
		dim = false,
		litDevices,
		litRooms,
		focusId = null,
		selectedId = null,
		label,
		svgEl = $bindable(),
		overlay,
		ondeviceenter,
		ondeviceleave,
		ondeviceclick,
		ondevicedown,
		onroomdown,
		onpointerdown,
		onpointermove,
		onpointerup,
		onbackgroundclick,
	}: Props = $props();

	const uid = $props.id();
	const GAP = 3;
	const b = $derived(box ?? planBounds(house, 2));
	const multi = $derived(floorIds.length > 1);
	const viewBox = $derived(
		multi
			? `${b.x} ${b.y - 2.2} ${b.w} ${floorIds.length * b.h + (floorIds.length - 1) * GAP + 2.2}`
			: `${b.x} ${b.y} ${b.w} ${b.h}`,
	);
	const floorName = (id: string) => house.floors.find((f) => f.id === id)?.name ?? '';

	function selRing(d: Device) {
		if (d.type !== 'appl') return null;
		const w = applianceCode(d.label).length * 0.42 + 0.6;
		return { x: -w / 2 - 0.35, w: w + 0.7 };
	}

	function onKey(e: KeyboardEvent, d: Device) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ondeviceclick?.(d);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<svg
	bind:this={svgEl}
	class="plan-svg plan"
	class:dim
	{viewBox}
	role="img"
	aria-label={label}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onclick={(e) => {
		if (!(e.target as Element).closest('.dev')) onbackgroundclick?.();
	}}
>
	{#if grid}
		<defs>
			<pattern id="g1-{uid}" width="1" height="1" patternUnits="userSpaceOnUse">
				<path class="gridline" d="M1 0H0V1" />
			</pattern>
			<pattern id="g5-{uid}" width="5" height="5" patternUnits="userSpaceOnUse">
				<path class="gridmajor" d="M5 0H0V5" />
			</pattern>
		</defs>
		<rect x={b.x} y={b.y} width={b.w} height={b.h} fill="url(#g1-{uid})" />
		<rect x={b.x} y={b.y} width={b.w} height={b.h} fill="url(#g5-{uid})" />
	{/if}

	{#each floorIds as fid, fi (fid)}
		{@const off = fi * (b.h + GAP)}
		{#if multi}
			<text class="ftitle" x={b.x + 0.3} y={b.y + off - 1}>{floorName(fid)}</text>
		{/if}

		{#each house.rooms.filter((r) => r.floorId === fid) as r (r.id)}
			<rect
				class="room"
				class:on={litRooms?.has(r.id)}
				class:sel={selectedId === r.id}
				x={r.x}
				y={r.y + off}
				width={r.w}
				height={r.h}
				role="presentation"
				onpointerdown={(e) => onroomdown?.(e, r)}
			/>
		{/each}
		{#each house.rooms.filter((r) => r.floorId === fid) as r (r.id)}
			<text class="rname" x={r.x + 0.6} y={r.y + off + r.h - 1.55}>{r.name}</text>
			<text class="rdim" x={r.x + 0.6} y={r.y + off + r.h - 0.7}>{r.w}′ × {r.h}′</text>
		{/each}

		{#each house.panels.filter((p) => p.marker?.floorId === fid) as p (p.id)}
			<rect class="pmark" x={p.marker!.x - 0.27} y={p.marker!.y + off - 1.2} width=".55" height="2.4" />
			<text class="pmark-t" x={p.marker!.x + 0.6} y={p.marker!.y + off}>{p.short.toUpperCase()}</text>
		{/each}

		{#each house.devices.filter((d) => d.floorId === fid) as d (d.id)}
			{@const c = findCircuit(house, d.circuitId)}
			{@const ring = selRing(d)}
			<g
				class="dev"
				class:on={litDevices?.has(d.id) || selectedId === d.id}
				class:focus={focusId === d.id}
				class:unassigned={!c}
				transform="translate({d.x} {d.y + off})"
				tabindex="0"
				role="button"
				aria-label="{deviceName(d)}, {roomName(house, d)}, {c ? `circuit ${circuitRef(house, c)}` : 'no circuit'}"
				onpointerenter={() => ondeviceenter?.(d)}
				onpointerleave={() => ondeviceleave?.(d)}
				onfocus={() => ondeviceenter?.(d)}
				onblur={() => ondeviceleave?.(d)}
				onpointerdown={(e) => ondevicedown?.(e, d)}
				onclick={(e) => {
					e.stopPropagation();
					ondeviceclick?.(d);
				}}
				onkeydown={(e) => onKey(e, d)}
			>
				<title>{deviceName(d)} · {c ? `${circuitRef(house, c)} ${c.label}` : 'No circuit'}</title>
				<DeviceSymbol type={d.type} label={d.label} />
				{#if selectedId === d.id}
					{#if ring}
						<rect class="selring" x={ring.x} y="-.9" width={ring.w} height="1.8" rx=".2" />
					{:else}
						<circle class="selring" r="1.15" />
					{/if}
				{/if}
			</g>
		{/each}
	{/each}

	{@render overlay?.()}
</svg>
