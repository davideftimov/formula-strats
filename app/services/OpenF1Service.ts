import type { Meeting } from '../types/meeting';
import type { Session } from '../types/session';
import type { Interval, ProcessedInterval } from '../types/interval';
import type { Driver } from '../types/driver';
import type { Lap } from '../types/lap';

export async function fetchLatestMeeting(): Promise<Meeting[]> {
	const currentYear = new Date().getFullYear();
	const response = await fetch(`https://api.openf1.org/v1/meetings?year=${currentYear}&meeting_key=latest`);

	if (!response.ok) {
		throw new Error('Failed to fetch meeting data');
	}

	const data = await response.json();
	return data;
}

export async function fetchLatestSession(): Promise<Session[]> {
	const currentYear = new Date().getFullYear();
	const response = await fetch(`https://api.openf1.org/v1/sessions?year=${currentYear}&session_key=latest`);
	// const response = await fetch(`https://api.openf1.org/v1/sessions?year=2024&session_key=9582`);

	if (!response.ok) {
		throw new Error('Failed to fetch session data');
	}

	const data = await response.json();
	return data;
}

export async function fetchSessions(session_type: string = 'Race', year?: number): Promise<Session[]> {
	// Default to current year if not specified
	const sessionYear = year || new Date().getFullYear();

	// Build the API URL with the session type filter
	const response = await fetch(`https://api.openf1.org/v1/sessions?year=${sessionYear}&session_type=${session_type}`);

	if (!response.ok) {
		throw new Error('Failed to fetch session data');
	}

	const data = await response.json();
	return data;
}

export async function fetchIntervals(sessionKey: string | number = 'latest', timestamp?: string): Promise<Interval[]> {
	// Get timestamp from 30 seconds ago
	const thirtySecondsAgo = new Date();
	thirtySecondsAgo.setSeconds(thirtySecondsAgo.getSeconds() - 40);
	const dateParam = thirtySecondsAgo.toISOString();
	console.log("DATE CHECK:", thirtySecondsAgo);
	console.log("DATE PARAM:", dateParam);

	// Create timestamp 30 seconds before the provided timestamp
	let timestampThirtySecondsAgo = "";
	if (timestamp) {
		const date = new Date(timestamp);
		date.setSeconds(date.getSeconds() - 60);
		timestampThirtySecondsAgo = date.toISOString().replace(/\.\d+Z$/, "");
		// timestampThirtySecondsAgo = date.toISOString();
	}

	// const response = await fetch(`https://api.openf1.org/v1/intervals?session_key=${sessionKey}&date>=${dateParam}`);
	const response = await fetch(`https://api.openf1.org/v1/intervals?session_key=${sessionKey}&date>=${timestampThirtySecondsAgo}&date<=${timestamp}`);

	if (!response.ok) {
		throw new Error('Failed to fetch interval data');
	}

	const data = await response.json();
	console.log("Interval data fetched");
	return data;
}

export async function fetchDrivers(sessionKey: string | number = 'latest'): Promise<Driver[]> {
	const response = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);

	if (!response.ok) {
		throw new Error('Failed to fetch driver data');
	}

	const data = await response.json();
	console.log("Driver data fetched");
	return data;
}

export async function fetchLaps(
	sessionKey: string | number = 'latest',
	driverNumber?: number,
	lapNumber?: number,
	timestamp?: string
): Promise<Lap[]> {
	let url = `https://api.openf1.org/v1/laps?session_key=${sessionKey}`;

	if (driverNumber !== undefined) {
		url += `&driver_number=${driverNumber}`;
	}

	if (lapNumber !== undefined) {
		url += `&lap_number=${lapNumber}`;
	}

	if (timestamp) {
		const date = new Date(timestamp);
		date.setSeconds(date.getSeconds() - 60);
		const timestampThirtySecondsAgo = date.toISOString().replace(/\.\d+Z$/, "");
		url += `&date_start<=${timestampThirtySecondsAgo}`;
	}

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch lap data');
	}

	const data = await response.json();
	console.log("Lap data fetched");
	return data;
}

export function processIntervalData(intervals: Interval[], previousProcessed: ProcessedInterval[] = []): ProcessedInterval[] {
	// Group intervals by driver_number and get only the latest one for each driver
	const driverMap = new Map<number, Interval>();

	intervals.forEach(interval => {
		const existing = driverMap.get(interval.driver_number);
		if (!existing || new Date(interval.date) > new Date(existing.date)) {
			driverMap.set(interval.driver_number, interval);
		}
	});

	// Convert map to array
	const latestIntervals = Array.from(driverMap.values());

	// Find the leader (both interval and gap_to_leader are null)
	const leader = latestIntervals.find(interval =>
		interval.interval === 0 && interval.gap_to_leader === 0
	);

	// Process all intervals
	const processedIntervals = latestIntervals.map(interval => {
		const processed: ProcessedInterval = { ...interval };

		if (leader && interval.driver_number === leader.driver_number) {
			processed.isLeader = true;
		} else {
			processed.isLeader = false;

			// If gap_to_leader is null, try to use previous data
			if (processed.gap_to_leader === null) {
				const previousData = previousProcessed.find(
					prev => prev.driver_number === interval.driver_number
				);

				if (previousData && previousData.gap_to_leader !== null) {
					processed.gap_to_leader = previousData.gap_to_leader;
				}
			}
		}

		return processed;
	});

	return processedIntervals;
}