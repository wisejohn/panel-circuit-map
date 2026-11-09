import type { Circuit, Device, DeviceType, House, Protection, Room } from './types';

/** Example house: main floor + basement + garage, 200 A main panel and a 60 A garage subpanel. */
export function sampleHouse(): House {
	const C = (panelId: string, slots: number[], amps: number, label: string, protection: Protection = ''): Circuit => ({
		id: panelId + slots[0],
		panelId,
		slots,
		amps,
		label,
		protection,
	});

	const circuits: Circuit[] = [
		C('M', [1, 3], 50, 'Range'),
		C('M', [2, 4], 30, 'Dryer'),
		C('M', [5, 7], 40, 'A/C condenser'),
		C('M', [6, 8], 30, 'Water heater'),
		C('M', [9], 20, 'Kitchen counter A', 'GFCI'),
		C('M', [10], 20, 'Kitchen counter B', 'GFCI'),
		C('M', [11], 20, 'Dishwasher + disposal'),
		C('M', [12], 20, 'Refrigerator'),
		C('M', [13], 20, 'Microwave'),
		C('M', [14], 20, 'Laundry'),
		C('M', [15], 20, 'Bathroom', 'GFCI'),
		C('M', [16], 15, 'Living room', 'AFCI'),
		C('M', [17], 15, 'Kitchen + living lights', 'AFCI'),
		C('M', [18], 15, 'Primary bedroom', 'AFCI'),
		C('M', [19], 15, 'Bedroom 2 + office', 'AFCI'),
		C('M', [20], 15, 'Bed + hall lights', 'AFCI'),
		C('M', [21], 20, 'Dining room'),
		C('M', [22], 15, 'Exterior', 'GFCI'),
		C('M', [23, 25], 60, 'Garage subpanel'),
		C('M', [24], 15, 'Smoke detectors', 'AFCI'),
		C('M', [26], 15, 'Basement family room', 'AFCI'),
		C('M', [27], 15, 'Basement bedroom', 'AFCI'),
		C('M', [28], 20, 'Basement bath', 'GFCI'),
		C('M', [29], 15, 'Furnace'),
		C('M', [30], 20, 'Sump pump'),
		C('G', [1], 20, 'Garage receptacles', 'GFCI'),
		C('G', [2], 15, 'Garage lights + opener'),
		C('G', [3, 5], 40, 'EV charger'),
		C('G', [4], 20, 'Workbench', 'GFCI'),
		C('G', [6], 20, 'Freezer'),
	];

	const R = (floorId: string, id: string, name: string, x: number, y: number, w: number, h: number): Room => ({
		id,
		floorId,
		name,
		x,
		y,
		w,
		h,
	});
	const rooms: Room[] = [
		R('1', 'kitchen', 'Kitchen', 0, 0, 16, 12),
		R('1', 'dining', 'Dining', 16, 0, 12, 12),
		R('1', 'living', 'Living room', 28, 0, 18, 16),
		R('1', 'hall', 'Hall', 16, 12, 12, 4),
		R('1', 'laundry', 'Laundry', 0, 12, 8, 6),
		R('1', 'bath', 'Bath', 8, 12, 8, 6),
		R('1', 'primary', 'Primary bedroom', 0, 18, 16, 12),
		R('1', 'bed2', 'Bedroom 2', 16, 16, 14, 14),
		R('1', 'office', 'Office', 30, 16, 16, 14),
		R('1', 'garage', 'Garage', 46, 4, 20, 26),
		R('B', 'family', 'Family room', 0, 0, 28, 16),
		R('B', 'utility', 'Utility', 28, 0, 18, 12),
		R('B', 'storage', 'Storage', 28, 12, 18, 18),
		R('B', 'bed3', 'Bedroom 3', 0, 16, 16, 14),
		R('B', 'bath2', 'Bath 2', 16, 16, 12, 6),
		R('B', 'stairs', 'Stairs', 16, 22, 12, 8),
	];

	type Row = [DeviceType, string, number, number, string?];
	const main: Row[] = [
		// Kitchen
		['appl', 'M1', 4, 1.4, 'Range'], ['appl', 'M13', 4, 3, 'Microwave'], ['appl', 'M11', 8, 1.4, 'Dishwasher'],
		['appl', 'M11', 10.5, 1.4, 'Disposal'], ['appl', 'M12', 14, 1.6, 'Refrigerator'],
		['gfci', 'M9', 0.9, 4], ['gfci', 'M9', 0.9, 8], ['gfci', 'M10', 12, 3.2], ['gfci', 'M10', 8, 8, 'Island'],
		['light', 'M17', 5, 6.2], ['light', 'M17', 11, 6.2],
		// Dining
		['rec', 'M21', 16.6, 6], ['rec', 'M21', 27.4, 6], ['rec', 'M21', 22, 11.4], ['light', 'M17', 22, 6, 'Chandelier'],
		// Living
		['rec', 'M16', 28.6, 4], ['rec', 'M16', 28.6, 12], ['rec', 'M16', 37, 0.6], ['rec', 'M16', 45.4, 4],
		['rec', 'M16', 45.4, 12], ['rec', 'M16', 37, 15.4],
		['fan', 'M17', 37, 8, 'Ceiling fan'], ['light', 'M17', 32, 4], ['light', 'M17', 42, 4],
		// Hall
		['smoke', 'M24', 22, 14], ['light', 'M20', 25.5, 14],
		// Laundry
		['appl', 'M2', 2.5, 13.5, 'Dryer'], ['rec', 'M14', 5.5, 12.6, 'Washer'], ['appl', 'M6', 6.5, 16.8, 'Water heater'],
		['light', 'M20', 5, 15],
		// Bath
		['gfci', 'M15', 10, 12.7], ['light', 'M15', 12, 15], ['fan', 'M15', 14.5, 13.6, 'Exhaust fan'],
		// Primary bedroom
		['rec', 'M18', 0.6, 21], ['rec', 'M18', 0.6, 25.5], ['rec', 'M18', 12, 29.4], ['rec', 'M18', 15.4, 21],
		['rec', 'M18', 15.4, 26], ['rec', 'M18', 8, 18.6], ['fan', 'M20', 8, 24, 'Ceiling fan'], ['smoke', 'M24', 3.5, 20.5],
		// Bedroom 2
		['rec', 'M19', 16.6, 20], ['rec', 'M19', 16.6, 25], ['rec', 'M19', 23, 29.4], ['rec', 'M19', 29.4, 23],
		['light', 'M20', 23, 23], ['smoke', 'M24', 26, 18],
		// Office
		['rec', 'M19', 30.6, 20], ['rec', 'M19', 30.6, 25], ['rec', 'M19', 38, 29.4], ['rec', 'M19', 45.4, 20],
		['rec', 'M19', 45.4, 26], ['light', 'M20', 38, 23], ['smoke', 'M24', 42, 18.6],
		// Exterior
		['gfci', 'M22', -1, 8, 'Patio'], ['gfci', 'M22', 22, 31, 'Rear yard'], ['light', 'M22', 37, -1, 'Porch light'],
		['appl', 'M5', -2.6, 24, 'A/C condenser'],
		// Garage
		['gfci', 'G1', 46.9, 9], ['gfci', 'G1', 65.1, 9], ['gfci', 'G1', 56, 4.6, 'Ceiling'],
		['light', 'G2', 51, 12], ['light', 'G2', 61, 12], ['appl', 'G2', 56, 8, 'Garage door opener'],
		['appl', 'G3', 64.4, 18, 'EV charger'], ['gfci', 'G4', 58, 29.4, 'Workbench'], ['gfci', 'G4', 62, 29.4, 'Workbench'],
		['rec', 'G6', 65.4, 25, 'Freezer'],
	];
	const basement: Row[] = [
		// Family room
		['rec', 'M26', 0.6, 4], ['rec', 'M26', 0.6, 11], ['rec', 'M26', 10, 0.6], ['rec', 'M26', 20, 0.6],
		['rec', 'M26', 27.4, 8], ['rec', 'M26', 14, 15.4],
		['light', 'M26', 7, 6], ['light', 'M26', 14, 6], ['light', 'M26', 21, 6], ['smoke', 'M24', 14, 10],
		// Utility
		['appl', 'M29', 33, 3, 'Furnace'], ['appl', 'M30', 42, 9, 'Sump pump'], ['light', 'M20', 38, 5],
		// Storage
		['light', 'M20', 37, 21], ['rec', 'M26', 45.4, 21], ['smoke', 'M24', 37, 16],
		// Bedroom 3
		['rec', 'M27', 0.6, 20], ['rec', 'M27', 0.6, 25], ['rec', 'M27', 8, 16.6], ['rec', 'M27', 15.4, 22],
		['rec', 'M27', 12, 29.4], ['light', 'M27', 8, 23], ['smoke', 'M24', 4, 19],
		// Bath 2
		['gfci', 'M28', 18, 17], ['light', 'M28', 22, 18.5], ['fan', 'M28', 26, 18, 'Exhaust fan'],
		// Stairs
		['light', 'M20', 22, 26, 'Stair light'],
	];
	let n = 0;
	const toDevice = (floorId: string) => ([type, circuitId, x, y, label = '']: Row): Device => ({
		id: `d${++n}`,
		floorId,
		type,
		circuitId,
		x,
		y,
		label,
	});

	return {
		version: 1,
		name: 'Sample house',
		panels: [
			{
				id: 'M',
				name: 'Main panel',
				short: 'Main',
				rating: '200 A · 30 spaces',
				spaces: 30,
				location: 'Garage, west wall',
				marker: { floorId: '1', x: 46.4, y: 17 },
			},
			{
				id: 'G',
				name: 'Garage subpanel',
				short: 'Sub',
				rating: '60 A · fed from main 23/25',
				spaces: 8,
				location: 'Garage, west wall',
				fedBy: 'M23',
				marker: { floorId: '1', x: 46.4, y: 21.5 },
			},
		],
		circuits,
		floors: [
			{ id: '1', name: 'Main floor', short: 'Main' },
			{ id: 'B', name: 'Basement', short: 'Bsmt' },
		],
		rooms,
		devices: [...main.map(toDevice('1')), ...basement.map(toDevice('B'))],
	};
}
