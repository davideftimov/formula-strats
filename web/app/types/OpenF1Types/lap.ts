export type Lap = {
	date_start: string;
	driver_number: number;
	duration_sector_1: number | null;
	duration_sector_2: number | null;
	duration_sector_3: number | null;
	i1_speed: number | null;
	i2_speed: number | null;
	is_pit_out_lap: boolean;
	lap_duration: number | null;
	lap_number: number;
	meeting_key: number;
	segments_sector_1: number[] | null;
	segments_sector_2: number[] | null;
	segments_sector_3: number[] | null;
	session_key: number;
	st_speed: number | null;
};
