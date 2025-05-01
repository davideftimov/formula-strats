export interface DriverInterval {
	name: string;
	color: string;
	gapToLeader: number | null; // null means this is the leader
	isLapped?: boolean;
	lapsDown?: number;
}
