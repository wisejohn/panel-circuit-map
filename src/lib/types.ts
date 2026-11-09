/**
 * The whole house is one JSON document. Positions and sizes are in feet.
 * Panels and circuits are shared across floors; rooms and devices belong to one floor.
 */

export type DeviceType = 'rec' | 'gfci' | 'light' | 'fan' | 'smoke' | 'appl';

export type Protection = '' | 'GFCI' | 'AFCI' | 'DUAL';

export interface Panel {
	id: string;
	name: string;
	/** Short name used in circuit references, e.g. "Main" → "Main 9". */
	short: string;
	/** Free text, e.g. "200 A main breaker". */
	rating: string;
	/** Number of breaker spaces. Odd spaces are on the left, even on the right. */
	spaces: number;
	location: string;
	/** Circuit id of the breaker that feeds this panel, for subpanels. */
	fedBy?: string;
	/**
	 * How breakers are numbered on the panel's directory.
	 * - 'odd-even' (default): odd spaces down the left, even down the right; tandem halves are 9A / 9B.
	 * - 'sequential': count breakers down the left column, then down the right.
	 */
	numbering?: 'odd-even' | 'sequential';
	/** Text put before every breaker number, e.g. "S" → S1, S2. */
	prefix?: string;
	/** Where the panel is drawn on the floor plan. */
	marker?: { floorId: string; x: number; y: number };
}

export interface Circuit {
	id: string;
	panelId: string;
	/**
	 * Breaker spaces used, numbered odd down the left and even down the right (the panel's geometry,
	 * whatever its printed numbering). One space for 120 V; two for a 240 V double-pole breaker:
	 * stacked on one side ([1, 3]) or side by side across one row ([1, 2]).
	 */
	slots: number[];
	/** For tandem (twin) breakers: which half of the space this circuit uses, upper 'a' or lower 'b'. */
	half?: 'a' | 'b';
	amps: number;
	label: string;
	protection: Protection;
}

export interface Floor {
	id: string;
	name: string;
	short: string;
	/** Picture of the real floor plan, drawn under the rooms in the plan editor so they can be traced. */
	trace?: TraceImage;
}

export interface TraceImage {
	/** The image as a data: URL, so it saves and exports with the house. */
	src: string;
	/** Natural size of the stored image, in pixels. */
	widthPx: number;
	heightPx: number;
	/** Feet per image pixel. */
	ftPerPx: number;
	/** Top-left corner of the (rotated) image on the plan, in feet. */
	x: number;
	y: number;
	/** Clockwise quarter turns. */
	rotation: 0 | 90 | 180 | 270;
	opacity: number;
	hidden?: boolean;
}

export interface Room {
	id: string;
	floorId: string;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Device {
	id: string;
	floorId: string;
	type: DeviceType;
	circuitId: string | null;
	x: number;
	y: number;
	/** Optional note. For appliances this is the appliance name. */
	label: string;
}

export interface House {
	version: 1;
	name: string;
	panels: Panel[];
	circuits: Circuit[];
	floors: Floor[];
	rooms: Room[];
	devices: Device[];
}
