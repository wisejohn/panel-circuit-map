<script lang="ts">
	import {
		cap,
		circuitRef,
		countsText,
		DEVICE_TYPES,
		deviceName,
		findCircuit,
		isFeeder,
		roomOf,
		roomsText,
	} from '../house';
	import { app } from '../state.svelte';
	import DeviceIcon from './DeviceIcon.svelte';
	import FloorPlan from './FloorPlan.svelte';
	import PanelBoard from './PanelBoard.svelte';

	const house = $derived(app.house);
	const floorIds = $derived(app.floorView === 'all' ? house.floors.map((f) => f.id) : [app.floorView]);
	const litList = $derived(house.devices.filter((d) => d.circuitId && app.activeSet.has(d.circuitId)));
	const litDevices = $derived(new Set(litList.map((d) => d.id)));
	const litRooms = $derived(new Set(litList.map((d) => roomOf(house, d)?.id).filter((id) => id !== undefined)));
	const active = $derived(findCircuit(house, app.active));
	const hoveredDevice = $derived(house.devices.find((d) => d.id === app.hoverDevice));

	function countOn(floorId: string) {
		return floorId === 'all' ? litList.length : litList.filter((d) => d.floorId === floorId).length;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') app.unpin();
	}}
/>

<div class="map">
	<PanelBoard />

	<div class="card">
		<div class="floorbar" role="group" aria-label="Floor">
			{#each [...house.floors.map((f) => ({ id: f.id, name: f.name })), { id: 'all', name: 'All floors' }] as f (f.id)}
				<button type="button" class="ftab" aria-pressed={app.floorView === f.id} onclick={() => (app.floorView = f.id)}>
					{f.name}
					{#if app.active && countOn(f.id)}<span class="cnt">{countOn(f.id)}</span>{/if}
				</button>
			{/each}
		</div>

		<div class="info" aria-live="polite">
			{#if active}
				{#if hoveredDevice}<span class="dname">{deviceName(hoveredDevice)} →</span>{/if}
				<span class="ckt">{circuitRef(house, active)}</span>
				<strong>{active.label}</strong>
				<span class="meta">
					{active.amps} A · {active.slots.length > 1 ? '240 V' : '120 V'}{active.protection ? ` · ${active.protection}` : ''}
				</span>
				<span>{countsText(litList) || 'Nothing mapped yet'}</span>
				{#if isFeeder(house, active.id)}<span class="rooms">feeds {app.activeSet.size - 1} subpanel circuits</span>{/if}
				<span class="rooms">{roomsText(house, litList)}</span>
				{#if app.pinned}<button type="button" class="btn" onclick={() => app.unpin()}>Unpin</button>{/if}
			{:else}
				<span class="hint">
					Hover a breaker or a device to trace it. Click to pin a circuit; Esc clears. Floor tabs show how many
					devices are on each floor.
				</span>
			{/if}
		</div>

		<div class="plan-scroll">
			<FloorPlan
				{house}
				{floorIds}
				label="Floor plan with devices"
				dim={!!app.active}
				{litDevices}
				{litRooms}
				focusId={app.hoverDevice}
				ondeviceenter={(d) => d.circuitId && app.hoverCircuit(d.circuitId, d.id)}
				ondeviceleave={() => app.clearHover()}
				ondeviceclick={(d) => d.circuitId && app.togglePin(d.circuitId)}
				onbackgroundclick={() => app.unpin()}
			/>
		</div>

		<div class="legend">
			{#each DEVICE_TYPES as t (t.type)}
				<span><DeviceIcon type={t.type} />{cap(t.name)}</span>
			{/each}
			<span>
				<svg class="ico" viewBox="-1 -1 2 2" aria-hidden="true"><rect class="pmark" x="-.3" y="-.9" width=".6" height="1.8" /></svg>
				Panel location
			</span>
		</div>
	</div>
</div>
