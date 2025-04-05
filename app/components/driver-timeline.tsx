import React, { useState, useEffect, useRef } from 'react';
import { fetchIntervals, fetchSessions, fetchDrivers, processIntervalData, fetchLaps } from '../services/OpenF1Service';
import type { Driver as ApiDriver } from '../types/driver';
import type { ProcessedInterval } from '../types/interval';
import type { Session } from '~/types/session';
import type { Lap } from '~/types/lap';
import { LapChart } from './lap-chart';

// Define the data structure for a driver in our component
interface DriverInterval {
	name: string;
	color: string;
	gapToLeader: number | null; // null means this is the leader
}

// Props for our component
interface DriverTimelineProps {
	drivers?: DriverInterval[]; // Make this optional for when we fetch real data
}

const circuitAvgPitTimeLost = [
	{ circuit_short_name: "Melbourne", green_flag: 19.3, sc_vsc: 12.8 },
	{ circuit_short_name: "Shanghai", green_flag: 23, sc_vsc: 15 },
	{ circuit_short_name: "Suzuka", green_flag: 22.5, sc_vsc: 10 },
	{ circuit_short_name: "Sakhir", green_flag: 23.2, sc_vsc: 13 },
	{ circuit_short_name: "Jeddah", green_flag: 20, sc_vsc: 11 },
	{ circuit_short_name: "Miami", green_flag: 17, sc_vsc: 9 },
	{ circuit_short_name: "Imola", green_flag: 26.5, sc_vsc: 16.5 },
	{ circuit_short_name: "Monte Carlo", green_flag: 19.2, sc_vsc: 12 },
	{ circuit_short_name: "Catalunya", green_flag: 22.5, sc_vsc: 12.5 },
	{ circuit_short_name: "Montreal", green_flag: 18.5, sc_vsc: 9.5 },
	{ circuit_short_name: "Spielberg", green_flag: 20, sc_vsc: 9 },
	{ circuit_short_name: "Silverstone", green_flag: 20, sc_vsc: 9 },
	{ circuit_short_name: "Spa-Francorchamps", green_flag: 18.5, sc_vsc: 11 },
	{ circuit_short_name: "Hungaroring", green_flag: 20.5, sc_vsc: 11.5 },
	{ circuit_short_name: "Zandvoort", green_flag: 21.5, sc_vsc: 15.5 },
	{ circuit_short_name: "Monza", green_flag: 23, sc_vsc: 15 },
	{ circuit_short_name: "Baku", green_flag: 20.5, sc_vsc: 11 },
	{ circuit_short_name: "Singapore", green_flag: 28.5, sc_vsc: 15 },
	{ circuit_short_name: "Austin", green_flag: 20, sc_vsc: 14 },
	{ circuit_short_name: "Mexico City", green_flag: 22, sc_vsc: 12 },
	{ circuit_short_name: "Interlagos", green_flag: 21, sc_vsc: 11 },
	{ circuit_short_name: "Las Vegas", green_flag: 21, sc_vsc: 13.5 },
	{ circuit_short_name: "Lusail", green_flag: 26.5, sc_vsc: 15.5 },
	{ circuit_short_name: "Yas Marina Circuit", green_flag: 22, sc_vsc: 15 }
];


export const DriverTimeline: React.FC<DriverTimelineProps> = ({ drivers: initialDrivers }) => {
	const [drivers, setDrivers] = useState<DriverInterval[]>(initialDrivers || []);
	const [session, setSession] = useState<Session | null>(null);
	const [sessions, setSessions] = useState<Session[]>([]);
	// const [sessionKey, setSessionKey] = useState<number | null | string>(9582);
	const [driversData, setDriversData] = useState<ApiDriver[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [timestamp, setTimestamp] = useState<string>("2024-08-25T13:03:19+00:00");
	const currentTimestampRef = useRef<string>("2025-03-23T07:42:00+00:00");
	const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
	const [lapsData, setLapsData] = useState<Lap[]>([]);

	// Fetch all available sessions once at component mount
	useEffect(() => {
		const getAllSessions = async () => {
			console.log("Fetching all sessions...");
			try {
				const fetchedSessions = await fetchSessions();
				if (fetchedSessions && fetchedSessions.length > 0) {
					setSessions(fetchedSessions);
					// Default to the last session in the array
					const defaultSession = fetchedSessions[fetchedSessions.length - 1];
					setSession(defaultSession);
					console.log("Default session selected:", defaultSession);
				} else {
					setError('No sessions found');
				}
			} catch (err) {
				setError('Failed to fetch sessions');
				console.error(err);
			}
		};

		getAllSessions();
	}, []);

	// Fetch drivers when session is available
	useEffect(() => {
		if (!session) return;
		const getDrivers = async () => {
			console.log("Fetching drivers...");
			if (!session) return;
			try {
				const drivers = await fetchDrivers(session.session_key);
				if (drivers && drivers.length > 0) {
					setDriversData(drivers);
					console.log("Drivers fetched:", drivers);
				} else {
					setError('No drivers found for this session');
				}
			} catch (err) {
				setError('Failed to fetch drivers');
				console.error(err);
			}
		};

		getDrivers();
	}, [session]);

	// Fetch intervals and driver data when session is available
	useEffect(() => {
		if (!session || driversData.length === 0) return;

		let intervalId: NodeJS.Timeout;
		let previousProcessedIntervals: ProcessedInterval[] = [];

		const fetchData = async () => {
			try {
				// Fetch intervals, laps and driver data
				const [intervalsData, lapsData] = await Promise.all([
					fetchIntervals(session.session_key, currentTimestampRef.current),
					fetchLaps(session.session_key, undefined, undefined, currentTimestampRef.current)
				]);

				console.log("Intervals data fetched:", intervalsData);
				console.log("Laps data fetched:", lapsData);

				// Store laps data
				setLapsData(lapsData);

				// Update timestamp by adding 4 seconds for the next fetch
				const currentDate = new Date(currentTimestampRef.current);
				currentDate.setSeconds(currentDate.getSeconds() + 4);
				const newTimestamp = currentDate.toISOString();
				currentTimestampRef.current = newTimestamp;
				setTimestamp(newTimestamp);
				console.log("Current timestamp:", newTimestamp);

				// Process the interval data
				const processedIntervals = processIntervalData(intervalsData, previousProcessedIntervals);
				previousProcessedIntervals = processedIntervals;

				// Create a map of driver colors by driver number
				const driverColorMap = new Map<number, string>();
				driversData.forEach(driver => {
					driverColorMap.set(driver.driver_number, driver.team_colour);
				});

				// Map the intervals to our DriverInterval format
				const mappedDrivers = processedIntervals.map(interval => {
					const driver = driversData.find(d => d.driver_number === interval.driver_number);

					return {
						name: driver?.name_acronym || `D${interval.driver_number}`,
						color: `#${driverColorMap.get(interval.driver_number)}` || '#CCCCCC', // Default gray color
						gapToLeader: interval.isLeader ? null : Number(interval.gap_to_leader),
					};
				});

				console.log("selectedDriver", selectedDriver);
				// Add simulated position after pit stop for selected driver
				if (selectedDriver) {
					const driverToPit = mappedDrivers.find(d => d.name === selectedDriver);
					if (driverToPit) {
						// Get pit time lost for current circuit
						const circuitName = session?.circuit_short_name || '';
						const pitTimeLostData = circuitAvgPitTimeLost.find(c => c.circuit_short_name === circuitName);
						const pitTimeLost = pitTimeLostData ? pitTimeLostData.green_flag : 20; // Default to 20s if not found

						// Create simulated position
						const simulatedDriver = {
							...driverToPit,
							name: `${driverToPit.name} (Pit)`,
							color: driverToPit.color + '80', // Add transparency
							gapToLeader: driverToPit.gapToLeader === null
								? pitTimeLost
								: (driverToPit.gapToLeader + pitTimeLost)
						};

						// Add to drivers array
						mappedDrivers.push(simulatedDriver);
					}
				}

				// Sort by position (leader first, then by gap)
				const sortedDrivers = mappedDrivers.sort((a, b) => {
					if (a.gapToLeader === null) return -1;
					if (b.gapToLeader === null) return 1;
					return (a.gapToLeader as number) - (b.gapToLeader as number);
				});
				console.log(sortedDrivers);
				setDrivers(sortedDrivers);
				setLoading(false);
			} catch (err) {
				// Just log the error
				console.error('Error fetching data:', err);
				if (loading) setLoading(false);
			}
		};

		// Fetch immediately and then every 4 seconds
		fetchData();
		intervalId = setInterval(fetchData, 4000);

		// Clean up
		return () => {
			clearInterval(intervalId);
		};
	}, [session, driversData, selectedDriver]);

	// Find the maximum gap to scale our visualization appropriately
	const maxGap = drivers.length > 0
		? Math.max(
			...drivers
				.filter((driver) => driver.gapToLeader !== null)
				.map((driver) => driver.gapToLeader as number)
		)
		: 0;

	if (loading) {
		return <div className="w-full p-5 my-5 font-sans">Loading driver data...</div>;
	}

	if (error) {
		return <div className="w-full p-5 my-5 font-sans text-red-500">Error: {error}</div>;
	}

	const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const selectedSessionKey = Number(e.target.value);
		const selectedSession = sessions.find(s => s.session_key === selectedSessionKey) || null;
		setSession(selectedSession);
		// Reset driver selection when changing sessions
		setSelectedDriver(null);
	};

	return (
		<div className="w-full font-sans">
			{/* Two-column layout container */}
			<div className="flex flex-row">
				{/* Left column - Driver Rankings */}
				<div className="w-1/5 flex flex-col justify-end">
					{drivers.length > 0 && (
						<div>
							<div className="max-w-full">
								<table className="bg-white border border-gray-200 rounded-lg shadow-sm w-full">
									<thead>
										<tr className="bg-gray-100">
											<th className="py-1 px-2 border-b border-gray-200 text-left w-12">Pos</th>
											<th className="py-1 px-2 border-b border-gray-200 text-left">Driver</th>
											<th className="py-1 px-2 border-b border-gray-200 text-right w-20">Gap</th>
										</tr>
									</thead>
									<tbody>
										{/* Reversing the drivers array to display from bottom to top */}
										{[...drivers].map((driver, index) => (
											<tr
												key={index}
												className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${driver.name.includes('(After Pit)') ? 'italic' : ''}`}
											>
												<td className="py-1 px-2 border-b border-gray-200">{index + 1}</td>
												<td className="py-1 px-2 border-b border-gray-200">
													<div className="flex items-center">
														<div
															className="w-3 h-3 rounded-full mr-1"
															style={{ backgroundColor: driver.color }}
														/>
														<span>{driver.name}</span>
													</div>
												</td>
												<td className="py-1 px-2 border-b border-gray-200 text-right">
													{driver.gapToLeader === null ? 'Leader' : `+${driver.gapToLeader.toFixed(3)}s`}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>

				{/* Right column - Selectors, Timeline, and Charts */}
				<div className="w-4/5 px-10">
					{/* Session and Driver selectors */}
					<div className="mb-4 flex gap-4 flex-wrap w-1/2">
						{/* Session selector */}
						<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 flex-1 min-w-[300px]">
							<h3 className="text-md font-bold mb-2">Select Session</h3>
							<select
								className="border rounded p-2 w-full"
								value={session?.session_key || ''}
								onChange={handleSessionChange}
							>
								<option value="" disabled>-- Select a session --</option>
								{sessions.map((s) => (
									<option key={s.session_key} value={s.session_key}>
										{s.location} - {s.session_name}
									</option>
								))}
							</select>
						</div>

						{/* Driver selector */}
						<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 flex-1 min-w-[200px]">
							<h3 className="text-md font-bold mb-2">Select Pit Driver</h3>
							<select
								className="border rounded p-2 w-full"
								value={selectedDriver || ""}
								onChange={(e) => setSelectedDriver(e.target.value || null)}
							>
								<option value="">-- Select a driver --</option>
								{drivers.map((driver, index) => (
									<option key={index} value={driver.name}>
										{driver.name}
									</option>
								))}
							</select>
						</div>


					</div>

					{/* Driver timeline */}
					{drivers.length === 0 ? (
						<p className="mt-4">No driver data available</p>
					) : (
						<div className="relative h-32 w-full"> {/* Increased height to accommodate multiple rows */}
							{/* Horizontal line */}
							<div className="absolute top-10 left-0 w-full h-0.5 bg-gray-300"></div>

							{/* Driver dots and labels */}
							{(() => {
								// Calculate position for each driver
								const driverPositions = drivers.map((driver, index) => {
									const position = driver.gapToLeader === null
										? 100  // Leader at the right edge
										: 100 - (driver.gapToLeader / maxGap) * 100; // Others proportionally to the left

									return {
										driver,
										position,
										index
									};
								});

								// Assign rows to drivers to avoid label overlap
								const MIN_LABEL_WIDTH = 3; // Estimated minimum width percentage for a label
								const rowAssignments: number[] = new Array(drivers.length).fill(0);

								// Sort by position (left to right) to better detect overlaps
								const sortedPositions = [...driverPositions].sort((a, b) => a.position - b.position);

								// Assign rows - more sophisticated algorithm
								sortedPositions.forEach((driverPos, i) => {
									const { index, position } = driverPos;

									// Find all previous drivers that would overlap with this one
									const overlapping = sortedPositions
										.slice(0, i)
										.filter(prev =>
											Math.abs(prev.position - position) < MIN_LABEL_WIDTH);

									if (overlapping.length > 0) {
										// Find the lowest unused row
										const usedRows = new Set(overlapping.map(p => rowAssignments[p.index]));
										let row = 0;
										while (usedRows.has(row)) row++;
										rowAssignments[index] = row;
									} else {
										// No overlap, use row 0
										rowAssignments[index] = 0;
									}
								});

								// Calculate max row to adjust container height if needed
								const maxRow = Math.max(...rowAssignments);

								// Render dots and labels
								return drivers.map((driver, index) => {
									const position = driverPositions.find(p => p.index === index)?.position || 0;
									const row = rowAssignments[index];

									// Calculate vertical offsets based on row
									const dotTop = 30; // Fixed position for all dots
									const labelTop = dotTop + 25 + (row * 24); // Increasing vertical space with row number
									const lineHeight = labelTop - dotTop;

									return (
										<div
											key={index}
											className="absolute"
											style={{
												left: `${position}%`,
												top: `${dotTop}px`,
												transform: 'translateX(-50%)',
											}}
										>
											{/* Driver dot */}
											<div
												className="w-5 h-5 rounded-full border-2 border-white shadow-md"
												style={{ backgroundColor: driver.color }}
											/>

											{/* Connecting line */}
											<div
												style={{
													position: 'absolute',
													left: '50%',
													top: '100%',
													width: '2px',
													height: `${lineHeight}px`,
													backgroundColor: driver.color,
													transform: 'translateX(-50%)',
												}}
											/>

											{/* Driver name */}
											<div
												style={{
													position: 'absolute',
													top: `${lineHeight + 5}px`,
													left: '50%',
													transform: 'translateX(-50%)',
													backgroundColor: 'rgba(255, 255, 255, 0.9)',
													padding: '2px 6px',
													borderRadius: '4px',
													border: `1px solid ${driver.color}`,
													fontWeight: 'bold',
													whiteSpace: 'nowrap',
													zIndex: 10,
													fontSize: '0.9rem',
												}}
											>
												{driver.name}
											</div>
										</div>
									);
								});
							})()}
						</div>
					)}

					{/* Lap Chart */}
					{lapsData.length > 0 && (
						<div className="mt-8">
							<h3 className="text-lg font-bold mb-2">Lap Timeline</h3>
							<LapChart laps={lapsData} drivers={driversData} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
};