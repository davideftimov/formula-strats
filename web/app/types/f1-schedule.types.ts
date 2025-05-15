export interface Session {
	Key: number;
	Type: string;
	Number: number;
	Name: string;
	StartDate: string;
	EndDate: string;
	GmtOffset: string;
	Path: string;
}

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
	Sessions: Session[];
	Key: number;
	Code: string;
	Number: number;
	Location: string;
	OfficialName: string;
	Name: string;
	Country: Country;
	Circuit: Circuit;
}

export interface F1Schedule {
	Year: number;
	Meetings: Meeting[];
}