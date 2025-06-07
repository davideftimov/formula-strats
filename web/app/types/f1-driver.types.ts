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
	[Key: string]: DriverDetails;
}

export type TimingData = {
	NoEntries?: number[];
	SessionPart?: number;
	CutOffTime?: string;
	CutOffPercentage?: string;

	Lines: {
		[Key: string]: TimingDataDriver;
	};
	Withheld: boolean;
};

export type TimingDataDriver = {
	Stats?: { TimeDiffToFastest: string; TimeDiffToPositionAhead: string }[];
	TimeDiffToFastest?: string;
	TimeDiffToPositionAhead?: string;
	GapToLeader: string;
	IntervalToPositionAhead?: {
		Value: string;
		Catching: boolean;
	};
	Line: number;
	Position: string;
	ShowPosition: boolean;
	RacingNumber: string;
	Retired: boolean;
	InPit: boolean;
	PitOut: boolean;
	Stopped: boolean;
	Status: number;
	Sectors: Sector[];
	Speeds: Speeds;
	BestLapTime: PersonalBestLapTime;
	LastLapTime: I1;
	NumberOfLaps: number;
	KnockedOut?: boolean;
	Cutoff?: boolean;
};

export type Sector = {
	Stopped: boolean;
	Value: string;
	PreviousValue?: string;
	Status: number;
	OverallFastest: boolean;
	PersonalFastest: boolean;
	Segments: {
		Status: number;
	}[];
};

export type Speeds = {
	I1: I1;
	I2: I1;
	Fl: I1;
	St: I1;
};

export type I1 = {
	Value: string;
	Status: number;
	OverallFastest: boolean;
	PersonalFastest: boolean;
};

export type PersonalBestLapTime = {
	Value: string;
	Position: number;
};

export interface F1Message {
	type: string; // e.g., "DriverTracker", "LapData"
	payload: DriverData | TimingData | SessionInfo | Lap[] | WeatherData; // The data can be of type DriverData, TimingData, or a string (e.g., "LAP 57")
}

export interface Lap {
	RacingNumber: string;
	LapNumber: number;
	LapTime: string;
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




export interface SessionInfo {
	Meeting: Meeting;
	ArchiveStatus: ArchiveStatus;
	Key: number;
	Type: string;
	Number: number;
	Name: string;
	StartDate: string;
	EndDate: string;
	GmtOffset: string;
	Path: string;
}

export interface ArchiveStatus {
	Status: string;
};

export interface Country {
	Key: number;
	Code: string;
	Name: string;
}

export interface Circuit {
	Key: number;
	ShortName: string;
}

export interface Meeting {
	Key: number;
	Code: string;
	Number: number;
	Location: string;
	OfficialName: string;
	Name: string;
	Country: Country;
	Circuit: Circuit;
}

// export interface F1Schedule {
// 	Year: number;
// 	Meetings: Meeting[];
// }

export interface WeatherData {
	AirTemp: string;
	Humidity: string;
	Pressure: string;
	Rainfall: string;
	TrackTemp: string;
	WindDirection: string;
	WindSpeed: string;
}


export interface F1Data {
	SessionInfo: SessionInfo;
	DriverData: DriverData;
	TimingData: TimingData;
	LapData: Lap[];
}