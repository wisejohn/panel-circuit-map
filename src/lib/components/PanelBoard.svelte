<script lang="ts">
	import { expandCircuit, isFeeder } from '../house';
	import { app } from '../state.svelte';
	import type { Circuit, Panel } from '../types';

	interface Props {
		/** 'map' traces circuits on hover/click; 'edit' selects breakers and turns open spaces into add buttons. */
		mode?: 'map' | 'edit';
		selectedId?: string | null;
		onselectcircuit?: (c: Circuit) => void;
		onselectpanel?: (p: Panel) => void;
		onaddcircuit?: (p: Panel, slot: number) => void;
	}

	let { mode = 'map', selectedId = null, onselectcircuit, onselectpanel, onaddcircuit }: Props = $props();

	const editing = $derived(mode === 'edit');

	function circuitsOf(p: Panel) {
		return app.house.circuits.filter((c) => c.panelId === p.id);
	}

	function openSpaces(p: Panel) {
		const used = new Set(circuitsOf(p).flatMap((c) => c.slots));
		return Array.from({ length: p.spaces }, (_, i) => i + 1).filter((s) => !used.has(s));
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

	const cell = (slot: number, span = 1) =>
		`grid-column:${slot % 2 === 0 ? 3 : 1};grid-row:${Math.ceil(slot / 2)} / span ${span}`;

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
				<div class="busbar" style="grid-row:1 / span {Math.ceil(p.spaces / 2)}"></div>
				{#each circuitsOf(p) as c (c.id)}
					{@const t = tag(c)}
					<button
						type="button"
						class="brk"
						class:r={c.slots[0] % 2 === 0}
						class:on={editing ? selectedId === c.id : app.activeSet.has(c.id)}
						style={cell(c.slots[0], c.slots.length)}
						title="{c.label} · {c.amps} A · {deviceCount(c)} devices"
						aria-pressed={editing ? selectedId === c.id : app.pinned === c.id}
						onmouseenter={() => !editing && app.hoverCircuit(c.id)}
						onmouseleave={() => !editing && app.clearHover()}
						onfocus={() => !editing && app.hoverCircuit(c.id)}
						onblur={() => !editing && app.clearHover()}
						onclick={() => onBreaker(c)}
					>
						<span class="num">{c.slots.join('·')}</span>
						<span class="lbl">{c.label}</span>
						{#if t}<span class="tag {t.cls}">{t.text}</span>{/if}
						<span class="amp">{c.amps}</span>
						<span class="h"></span>
					</button>
				{/each}
				{#each openSpaces(p) as s (s)}
					{#if editing}
						<button
							type="button"
							class="space add"
							class:r={s % 2 === 0}
							style={cell(s)}
							onclick={() => onaddcircuit?.(p, s)}>{s} · + add breaker</button
						>
					{:else}
						<div class="space" class:r={s % 2 === 0} style={cell(s)}>{s} · space</div>
					{/if}
				{/each}
			</div>
			<div class="panel-foot">{p.location}</div>
		</section>
	{/each}
</div>
