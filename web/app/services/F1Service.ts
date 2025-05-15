import type { Meeting, DriverData, DriverDetails, DriverTracker, Lap } from '../types';
import { logger } from '../utils/logger';

export async function fetchMeetings(year?: number): Promise<Meeting[]> {
	const currentYear = year || new Date().getFullYear();

	let url = `http://localhost:8000/api/f1-static/${currentYear}/Index.json`;

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch meeting data');
	}

	const data = await response.json();
	return data.Meetings;
}

export async function fetchDrivers(sessionPath: string): Promise<DriverDetails[]> {
	logger.log(sessionPath);
	const url = `http://localhost:8000/api/f1-static/${sessionPath}DriverList.json`;

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch driver data');
	}

	const driverMap: DriverData = await response.json();
	const driverList: DriverDetails[] = Object.values(driverMap);

	logger.log(driverList);
	logger.log("Driver data fetched");
	return driverList;
}

export async function fetchDriverTrackerData(sessionPath: string): Promise<DriverTracker[]> {
	logger.log(sessionPath);
	const url = `http://localhost:8000/api/f1-static/${sessionPath}DriverTracker.json`;

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch driver data');
	}

	const data = await response.json();

	logger.log(data.Lines);
	logger.log("Driver data fetched");
	return data.Lines;
}

export async function fetchLapData(): Promise<Lap[]> {
	const url = `http://localhost:8000/api/lap-data`;

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error('Failed to fetch lap data');
	}

	const data = await response.json();
	logger.log("TEEEEEST");
	logger.log(data[0])
	logger.log(data);
	logger.log("Lap data fetched");
	return data;
}