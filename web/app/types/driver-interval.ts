export interface DriverInterval {
	name: string;
	racingNumber: string; // Added to store the driver's racing number
	color: string;
	gapToLeader: number | null; // null means this is the leader
	isLapped?: boolean;
	lapsDown?: number;
}
