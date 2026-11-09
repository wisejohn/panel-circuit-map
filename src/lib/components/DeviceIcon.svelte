<script lang="ts">
	import type { DeviceType } from '../types';
	import DeviceSymbol from './DeviceSymbol.svelte';

	let { type }: { type: DeviceType } = $props();
</script>

<svg class="ico" viewBox="-1 -1 2 2" aria-hidden="true">
	<g class="dev"><DeviceSymbol {type} label="A" /></g>
</svg>
