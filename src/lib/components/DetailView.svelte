<script lang="ts">
	import { circuitNumber, countBy, DEVICE_TYPES, isFeeder, roomsText, sortedCircuits } from '../house';
	import { app } from '../state.svelte';
	import type { Circuit } from '../types';
	import DeviceIcon from './DeviceIcon.svelte';

	const house = $derived(app.house);
	const rows = $derived(
		sortedCircuits(house).map((c) => {
			const devices = house.devices.filter((d) => d.circuitId === c.id);
			return { c, devices, by: countBy(devices) };
		}),
	);
	const max = $derived(Math.max(1, ...rows.map((r) => r.devices.length)));
	const totals = $derived(countBy(house.devices));
	const unassigned = $derived(house.devices.filter((d) => !d.circuitId));
	const openSpaces = $derived(
		house.panels.reduce((a, p) => a + p.spaces, 0) - house.circuits.reduce((a, c) => a + c.slots.length, 0),
	);

	function show(c: Circuit) {
		app.view = 'map';
		app.pin(c.id);
	}

	function protTag(c: Circuit) {
		if (c.protection === 'GFCI') return { cls: 'gf', text: 'GF' };
		if (c.protection === 'AFCI') return { cls: 'af', text: 'AF' };
		if (c.protection === 'DUAL') return { cls: 'af', text: 'DF' };
		return null;
	}
</script>

<div style="display:flex;flex-direction:column;gap:12px">
	<div class="summary">
		<span><b>{house.panels.length}</b>panels</span>
		<span><b>{house.floors.length}</b>floors</span>
		<span><b>{house.circuits.length}</b>circuits</span>
		<span><b>{house.devices.length}</b>devices mapped</span>
		<span><b>{house.rooms.length}</b>rooms</span>
		<span><b>{openSpaces}</b>open spaces</span>
	</div>

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Circuit</th>
					<th>Description</th>
					<th>Rating</th>
					{#each DEVICE_TYPES as t (t.type)}
						<th class="t"><DeviceIcon type={t.type} />{t.short}</th>
					{/each}
					<th>Total</th>
					<th>Rooms</th>
				</tr>
			</thead>
			<tbody>
				{#each house.panels as p (p.id)}
					<tr class="grp">
						<th colspan={DEVICE_TYPES.length + 5}>{p.name}<span>{p.rating}</span></th>
					</tr>
					{#each rows.filter((r) => r.c.panelId === p.id) as { c, devices, by } (c.id)}
						{@const tag = protTag(c)}
						<tr
							class="row"
							tabindex="0"
							onclick={() => show(c)}
							onkeydown={(e) => {
								if (e.key === 'Enter') show(c);
							}}
						>
							<td class="c">{circuitNumber(house, c)}</td>
							<td class="d">{c.label}</td>
							<td class="c">
								{c.amps} A{c.slots.length > 1 ? ' 2P' : ''}
								{#if tag}<span class="tag {tag.cls}">{tag.text}</span>{/if}
							</td>
							{#each DEVICE_TYPES as t (t.type)}
								<td class="n" class:z={!by[t.type]}>{by[t.type] || '·'}</td>
							{/each}
							<td class="n">
								<span class="tot">{devices.length}<span class="bar" style="width:{(devices.length / max) * 48}px"></span></span>
							</td>
							<td class="rm">{isFeeder(house, c.id) ? 'Feeds a subpanel' : roomsText(house, devices) || '—'}</td>
						</tr>
					{/each}
				{/each}
				{#if unassigned.length}
					<tr class="grp"><th colspan={DEVICE_TYPES.length + 5}>No circuit assigned</th></tr>
					<tr>
						<td class="c">—</td>
						<td class="d">Unassigned</td>
						<td></td>
						{#each DEVICE_TYPES as t (t.type)}
							{@const n = countBy(unassigned)[t.type]}
							<td class="n" class:z={!n}>{n || '·'}</td>
						{/each}
						<td class="n">{unassigned.length}</td>
						<td class="rm">{roomsText(house, unassigned)}</td>
					</tr>
				{/if}
			</tbody>
			<tfoot>
				<tr>
					<td></td>
					<td>All circuits</td>
					<td></td>
					{#each DEVICE_TYPES as t (t.type)}
						<td class="n">{totals[t.type] ?? 0}</td>
					{/each}
					<td class="n">{house.devices.length}</td>
					<td></td>
				</tr>
			</tfoot>
		</table>
	</div>
	<p class="note">Click a row to show that circuit on the map.</p>
</div>
