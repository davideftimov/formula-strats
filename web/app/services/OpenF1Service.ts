import type { Meeting } from '../types/meeting';
import type { Session } from '../types/session';
import type { Interval, ProcessedInterval } from '../types/interval';
import type { Driver } from '../types/driver';
import type { Lap } from '../types/lap';
import { logger } from '../utils/logger';

export async function fetchMeetings(sessionKey?: string | number, year?: number): Promise<Meeting[]> {
	const currentYear = year || new Date().getFullYear();

	let url = `https://api.openf1.org/v1/meetings?year=${currentYear}`;

	if (sessionKey) {
		url += `&meeting_key=${sessionKey}`;
	}

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch meeting data');
	}

	const data = await response.json();
	return data;
}

export async function fetchSessions(sessionKey?: string | number, session_type?: string, year?: number): Promise<Session[]> {
	const currentYear = year || new Date().getFullYear();

	let url = `https://api.openf1.org/v1/sessions?year=${currentYear}`;

	if (sessionKey) {
		url += `&session_key=${sessionKey}`;
	}
	if (session_type) {
		url += `&session_type=${session_type}`;
	}

	const response = await fetch(`${url}`);

	if (!response.ok) {
		throw new Error('Failed to fetch session data');
	}

	const data = await response.json();
	return data;
}

export async function fetchIntervals(sessionKey: string | number = 'latest', timestamp?: string, finished: boolean = false, delay: number = 0): Promise<Interval[]> {
	let url = `https://api.openf1.org/v1/intervals?session_key=${sessionKey}`;

	if (timestamp) {
		if (finished) {
			url += `&date>=${timestamp}`;
		} else {
			const date = new Date(timestamp);
			date.setSeconds(date.getSeconds() - 60);
			let timestampThirtySecondsAgo = date.toISOString().replace(/\.\d+Z$/, "");
			url += `&date>=${timestampThirtySecondsAgo}`;
			url += `&date<=${timestamp}`;
		}
	} else {
		const delayTime = new Date();
		if (delay > 0) {
			delayTime.setSeconds(delayTime.getSeconds() - delay);
			const delayTimeString = delayTime.toISOString();
			logger.log("INTERVAL DELAY TIME:", delayTimeString);
			url += `&date<=${delayTimeString}`;
		}
		const fortySecondsAgo = new Date(delayTime);
		fortySecondsAgo.setSeconds(fortySecondsAgo.getSeconds() - 40);
		const fortySecondsAgoString = fortySecondsAgo.toISOString();
		logger.log("INTERVAL FORTY SECONDS AGO TIME:", fortySecondsAgoString);
		url += `&date>=${fortySecondsAgoString}`;
	}


	const response = await fetch(url);
	// const response = await fetch(`https://api.openf1.org/v1/intervals?session_key=${sessionKey}&date>=${timestampThirtySecondsAgo}&date<=${timestamp}`);

	if (!response.ok) {
		throw new Error('Failed to fetch interval data');
	}

	const data = await response.json();
	logger.log("Interval data fetched");
	return data;
}

export async function fetchDrivers(sessionKey: string | number = 'latest'): Promise<Driver[]> {
	const response = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);

	if (!response.ok) {
		throw new Error('Failed to fetch driver data');
	}

	const data = await response.json();
	logger.log("Driver data fetched");
	return data;
}

export async function fetchLaps(
	sessionKey: string | number = 'latest',
	driverNumber?: number,
	lapNumber?: number,
	timestamp?: string,
	delay: number = 0
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

	if (delay > 0) {
		const newDate = new Date();
		newDate.setSeconds(newDate.getSeconds() - delay);
		const dateParam = newDate.toISOString();
		url += `&date_start<=${dateParam}`;
		logger.log("DATE LAP FETCH:", newDate);
	}



	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch lap data');
	}

	const data = await response.json();
	logger.log("Lap data fetched");
	return data;
}

export function processIntervalData(intervals: Interval[], previousProcessed: ProcessedInterval[] = []): ProcessedInterval[] {
	// Group intervals by driver_number and get only the latest one for each driver with a non-null gap
	const driverMap = new Map<number, Interval>();
	intervals.forEach(interval => {
		const existing = driverMap.get(interval.driver_number);
		// Only consider intervals with a valid gap_to_leader
		if (interval.gap_to_leader !== null && (!existing || new Date(interval.date) > new Date(existing.date))) {
			driverMap.set(interval.driver_number, interval);
		}
	});
	logger.log("Driver map (latest valid intervals):", driverMap);

	// Convert map to array and create initial processed intervals
	const latestIntervals = Array.from(driverMap.values());
	let processedIntervals: ProcessedInterval[] = latestIntervals.map(interval => ({
		...interval,
		isLeader: false // Initialize isLeader flag
	}));

	// Keep track of drivers present in the latest data
	const currentDrivers = new Set(processedIntervals.map(p => p.driver_number));

	// Add drivers from previous data if they are missing in the current data
	previousProcessed.forEach(prevInterval => {
		if (!currentDrivers.has(prevInterval.driver_number)) {
			// Ensure the carried-over interval also has the isLeader flag initialized
			processedIntervals.push({ ...prevInterval, isLeader: false });
			logger.log(`Adding missing driver ${prevInterval.driver_number} from previous data.`);
		}
	});

	// Find the leader (gap_to_leader is 0 or null/undefined if no leader found in current data)
	// Note: A driver carried over from previous data might be the leader if the actual leader dropped out
	const leader = processedIntervals.find(interval => interval.gap_to_leader === 0);

	// Set isLeader flag for all intervals based on the found leader
	processedIntervals.forEach(interval => {
		interval.isLeader = leader ? interval.driver_number === leader.driver_number : false;
	});

	return processedIntervals;
}