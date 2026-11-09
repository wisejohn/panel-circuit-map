<script lang="ts">
	import DetailView from './lib/components/DetailView.svelte';
	import EditorView from './lib/components/EditorView.svelte';
	import MapView from './lib/components/MapView.svelte';
	import PanelsView from './lib/components/PanelsView.svelte';
	import { app, isHouse, VIEWS, type View } from './lib/state.svelte';

	const TAB_NAMES: Record<View, string> = {
		map: 'Map',
		detail: 'Circuit detail',
		editor: 'Plan editor',
		panels: 'Panels',
	};

	let fileInput = $state<HTMLInputElement>();
	let message = $state('');

	// Keep the view in the URL hash so a reload stays on the same tab.
	function readHash() {
		const v = location.hash.slice(1) as View;
		if (VIEWS.includes(v)) app.view = v;
	}
	readHash();
	$effect(() => {
		if (location.hash !== `#${app.view}`) history.replaceState(null, '', `#${app.view}`);
	});

	function exportJson() {
		const blob = new Blob([JSON.stringify(app.house, null, '\t')], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `${app.house.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'house'}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
		message = 'Exported.';
	}

	async function importJson(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		try {
			const data: unknown = JSON.parse(await file.text());
			if (!isHouse(data)) throw new Error('not a house file');
			app.replaceHouse(data);
			message = `Imported ${file.name}.`;
		} catch {
			message = `${file.name} isn't a Panel Circuit Map file (version 1). Nothing was changed.`;
		}
	}

	function reset() {
		if (confirm('Replace your house with the sample house? Export first if you want to keep your changes.')) {
			app.resetToSample();
			message = 'Loaded the sample house.';
		}
	}
</script>

<svelte:window onhashchange={readHash} />

<div class="app">
	<header class="top">
		<div>
			<h1>Panel Circuit Map</h1>
			<p class="sub">
				<input
					aria-label="House name"
					value={app.house.name}
					oninput={(e) => (app.house.name = e.currentTarget.value)}
					style="font:inherit;color:inherit;background:transparent;border:0;padding:0;width:16em"
				/>
			</p>
		</div>
		<div class="top-right">
			{#if message}<span class="toast" role="status">{message}</span>{/if}
			<button type="button" class="btn" onclick={exportJson}>Export</button>
			<button type="button" class="btn" onclick={() => fileInput?.click()}>Import</button>
			<button type="button" class="btn" onclick={reset}>Load sample</button>
			<input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={importJson} />
			<div class="tabs" role="tablist" aria-label="Views">
				{#each VIEWS as v (v)}
					<button type="button" role="tab" aria-selected={app.view === v} onclick={() => (app.view = v)}>{TAB_NAMES[v]}</button>
				{/each}
			</div>
		</div>
	</header>

	{#if app.view === 'map'}
		<MapView />
	{:else if app.view === 'detail'}
		<DetailView />
	{:else if app.view === 'editor'}
		<EditorView />
	{:else}
		<PanelsView />
	{/if}
</div>
