export interface DriverDetails {
	RacingNumber: string;
	BroadcastName: string;
	FullName: string;
	Tla: string;
	Line: number;
	TeamName: string;
	TeamColour: string;
	FirstName: string;
	LastName: string;
	Reference: string;
	HeadshotUrl: string;
}

export interface DriverData {
	[driverId: string]: DriverDetails;
}

export interface DriverTracker {
	Position: string;
	ShowPosition: boolean;
	RacingNumber: string;
	LapTime: string;
	LapState: number;
	DiffToAhead: string;    // e.g., "LAP 57" or "+4.630". Mixed type: status or time delta.
	DiffToLeader: string;   // e.g., "LAP 57" or "+4.630". Mixed type: status or time delta.
	OverallFastest: boolean;
	PersonalFastest: boolean;
}

export interface Lap {
	RacingNumber: string;
	LapNumber: number;
	LapTime: string;
}