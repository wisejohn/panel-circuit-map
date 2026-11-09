<svelte:options namespace="svg" />

<script lang="ts">
	import { applianceCode } from '../house';
	import type { DeviceType } from '../types';

	interface Props {
		type: DeviceType;
		label?: string;
	}

	let { type, label = '' }: Props = $props();

	const code = $derived(applianceCode(label));
	const w = $derived(code.length * 0.42 + 0.6);
</script>

<!-- Symbols are drawn around (0, 0) in feet. -->
{#if type === 'rec'}
	<circle class="hit" r="1" />
	<circle class="s" r=".55" />
	<line class="k" x1="-.18" y1="-.3" x2="-.18" y2=".3" />
	<line class="k" x1=".18" y1="-.3" x2=".18" y2=".3" />
{:else if type === 'gfci'}
	<circle class="hit" r="1" />
	<rect class="s" x="-.75" y="-.5" width="1.5" height="1" rx=".2" />
	<text font-size=".55">GF</text>
{:else if type === 'light'}
	<circle class="hit" r="1" />
	<circle class="s" r=".55" />
	<line class="k" x1="-.39" y1="-.39" x2=".39" y2=".39" />
	<line class="k" x1="-.39" y1=".39" x2=".39" y2="-.39" />
{:else if type === 'fan'}
	<circle class="hit" r="1" />
	<circle class="s" r=".65" />
	{#each [0, 120, 240] as a (a)}
		<ellipse class="b" rx=".3" ry=".12" transform="rotate({a}) translate(.3 0)" />
	{/each}
{:else if type === 'smoke'}
	<circle class="hit" r="1" />
	<circle class="s" r=".6" />
	<text font-size=".42">SD</text>
{:else}
	<rect class="hit" x={-w / 2 - 0.3} y="-.85" width={w + 0.6} height="1.7" />
	<rect class="s" x={-w / 2} y="-.55" width={w} height="1.1" rx=".15" />
	<text font-size=".55">{code}</text>
{/if}
