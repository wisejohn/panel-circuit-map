<script lang="ts">
	import {
		breakerKind,
		circuitNumber,
		expandCircuit,
		isFeeder,
		isRight,
		openCells,
		placementKey,
		rowOf,
		type Placement,
	} from '../house';
	import { app } from '../state.svelte';
	import type { Circuit, Panel } from '../types';

	interface Props {
		/** 'map' traces circuits on hover/click; 'edit' selects breakers and turns open spaces into add buttons. */
		mode?: 'map' | 'edit';
		selectedId?: string | null;
		onselectcircuit?: (c: Circuit) => void;
		onselectpanel?: (p: Panel) => void;
		onaddcircuit?: (p: Panel, at: Placement) => void;
	}

	let { mode = 'map', selectedId = null, onselectcircuit, onselectpanel, onaddcircuit }: Props = $props();

	const editing = $derived(mode === 'edit');

	function circuitsOf(p: Panel) {
		return app.house.circuits.filter((c) => c.panelId === p.id);
	}

	function deviceCount(c: Circuit) {
		const set = expandCircuit(app.house, c.id);
		return app.house.devices.filter((d) => d.circuitId && set.has(d.circuitId)).length;
	}

	function tag(c: Circuit): { cls: string; text: string } | null {
		if (isFeeder(app.house, c.id)) return { cls: 'fd', text: 'SUB' };
		if (c.protection === 'GFCI') return { cls: 'gf', text: 'GF' };
		if (c.protection === 'AFCI') return { cls: 'af', text: 'AF' };
		if (c.protection === 'DUAL') return { cls: 'af', text: 'DF' };
		return null;
	}

	/**
	 * Grid placement. Each panel row is two half-height tracks, so a tandem half takes one track,
	 * a normal breaker two, and a stacked 240 V breaker four. Column 2 is the bus bar.
	 */
	function cellStyle(p: Placement) {
		const kind = breakerKind(p);
		const row = rowOf(p.slots[0]);
		const column = kind === 'across' ? '1 / span 3' : isRight(p.slots[0]) ? '3' : '1';
		const start = 2 * row - 1 + (p.half === 'b' ? 1 : 0);
		const span = kind === 'half' ? 1 : kind === 'stacked' ? 4 : 2;
		return `grid-column:${column};grid-row:${start} / span ${span}`;
	}

	function spaceText(p: Placement) {
		return `${p.slots[0]}${p.half ? p.half.toUpperCase() : ''} · ${editing ? '+ add breaker' : 'space'}`;
	}

	function onBreaker(c: Circuit) {
		if (editing) onselectcircuit?.(c);
		else app.togglePin(c.id);
	}
</script>

<div class="panels" class:dim={!editing && !!app.active}>
	{#each app.house.panels as p (p.id)}
		<section class="panel" class:sel={editing && selectedId === p.id}>
			<div class="panel-head">
				{#if editing}
					<button type="button" class="panel-name" onclick={() => onselectpanel?.(p)}><h2>{p.name}</h2></button>
				{:else}
					<h2>{p.name}</h2>
				{/if}
				<span>{p.rating}</span>
			</div>
			<div class="bus">
				<div class="busbar" style="grid-row:1 / span {p.spaces}"></div>
				{#each circuitsOf(p) as c (c.id)}
					{@const t = tag(c)}
					{@const kind = breakerKind(c)}
					<button
						type="button"
						class="brk {kind}"
						class:r={kind !== 'across' && isRight(c.slots[0])}
						class:on={editing ? selectedId === c.id : app.activeSet.has(c.id)}
						style={cellStyle(c)}
						title="{circuitNumber(app.house, c)} · {c.label} · {c.amps} A · {deviceCount(c)} devices"
						aria-pressed={editing ? selectedId === c.id : app.pinned === c.id}
						onmouseenter={() => !editing && app.hoverCircuit(c.id)}
						onmouseleave={() => !editing && app.clearHover()}
						onfocus={() => !editing && app.hoverCircuit(c.id)}
						onblur={() => !editing && app.clearHover()}
						onclick={() => onBreaker(c)}
					>
						<span class="num">{circuitNumber(app.house, c)}</span>
						<span class="lbl">{c.label}</span>
						{#if t}<span class="tag {t.cls}">{t.text}</span>{/if}
						<span class="amp">{c.amps}</span>
						<span class="h"></span>
					</button>
				{/each}
				{#each openCells(app.house, p.id) as cell (placementKey(cell))}
					{#if editing}
						<button
							type="button"
							class="space add"
							class:half={!!cell.half}
							class:r={isRight(cell.slots[0])}
							style={cellStyle(cell)}
							onclick={() => onaddcircuit?.(p, cell)}>{spaceText(cell)}</button
						>
					{:else}
						<div class="space" class:half={!!cell.half} class:r={isRight(cell.slots[0])} style={cellStyle(cell)}>
							{spaceText(cell)}
						</div>
					{/if}
				{/each}
			</div>
			<div class="panel-foot">{p.location}</div>
		</section>
	{/each}
</div>
