export interface Interval {
	date: string;
	driver_number: number;
	gap_to_leader: number | string | null;
	interval: number | string | null;
	meeting_key: number;
	session_key: number;
}

export interface ProcessedInterval extends Interval {
	isLeader?: boolean;
}