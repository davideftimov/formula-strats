import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Lap } from '~/types/lap';
import type { Driver } from '~/types/driver';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LapChartProps {
	laps: Lap[];
	drivers: Driver[];
}

export const LapChart: React.FC<LapChartProps> = ({ laps, drivers }) => {
	// State to toggle between normal view and showing all outliers
	const [showOutliers, setShowOutliers] = useState(false);
	// State for selected drivers (using driver numbers)
	const [selectedDrivers, setSelectedDrivers] = useState<Set<number>>(new Set());
	// State to control dropdown visibility
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);
	// Add ref for dropdown container to detect outside clicks
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Initialize selected drivers when drivers prop changes
	useEffect(() => {
		setSelectedDrivers(new Set(drivers.map(d => d.driver_number)));
	}, [drivers]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsSelectorOpen(false);
			}
		};

		// Add event listener when dropdown is open
		if (isSelectorOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		// Cleanup event listener
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isSelectorOpen]);

	// Get all available driver numbers
	const allDriverNumbers = useMemo(() => drivers.map(d => d.driver_number), [drivers]);

	// Process lap data
	const processedData = useMemo(() => {
		const lapsByDriver = new Map<number, Lap[]>();

		if (!laps.length) return lapsByDriver;

		// Group laps by driver
		laps.forEach(lap => {
			if (!lapsByDriver.has(lap.driver_number)) {
				lapsByDriver.set(lap.driver_number, []);
			}
			lapsByDriver.get(lap.driver_number)?.push(lap);
		});

		// Sort laps for each driver by lap number
		lapsByDriver.forEach((driverLaps, driverNumber) => {
			driverLaps.sort((a, b) => a.lap_number - b.lap_number);
		});

		return lapsByDriver;
	}, [laps]);

	// Get min and max lap numbers to determine chart width
	const lapRange = useMemo(() => {
		let minLap = Infinity;
		let maxLap = 0;

		laps.forEach(lap => {
			minLap = Math.min(minLap, lap.lap_number);
			maxLap = Math.max(maxLap, lap.lap_number);
		});

		return { minLap: minLap === Infinity ? 1 : minLap, maxLap };
	}, [laps]);

	// Calculate lap duration ranges and identify outliers
	const durationRanges = useMemo(() => {
		let minDuration = Infinity;
		let maxDuration = 0;
		const durations: number[] = [];

		// Collect all valid durations
		laps.forEach(lap => {
			if (lap.lap_duration !== null) {
				durations.push(lap.lap_duration);
				minDuration = Math.min(minDuration, lap.lap_duration);
				maxDuration = Math.max(maxDuration, lap.lap_duration);
			}
		});

		// Sort durations for percentile calculations
		durations.sort((a, b) => a - b);

		// Calculate interquartile range (IQR) for outlier detection
		const q1Index = Math.floor(durations.length * 0.25);
		const q3Index = Math.floor(durations.length * 0.75);
		const q1 = durations[q1Index] || minDuration;
		const q3 = durations[q3Index] || maxDuration;
		const iqr = q3 - q1;

		// Define outlier threshold (1.5 times the IQR from quartiles)
		const lowerThreshold = Math.max(0, q1 - 1.5 * iqr);
		const upperThreshold = q3 + 1.5 * iqr;

		// Filter out outliers for normal range calculation
		const normalDurations = durations.filter(d => d >= lowerThreshold && d <= upperThreshold);
		const normalMinDuration = normalDurations.length ? Math.min(...normalDurations) : minDuration;
		const normalMaxDuration = normalDurations.length ? Math.max(...normalDurations) : maxDuration;

		// Add a small buffer (5%) to the normal range for better visualization
		const buffer = (normalMaxDuration - normalMinDuration) * 0.05;

		return {
			// Full range including outliers
			fullRange: {
				minDuration: minDuration === Infinity ? 0 : minDuration,
				maxDuration: maxDuration === 0 ? 100 : maxDuration
			},
			// Normal range excluding outliers
			normalRange: {
				minDuration: Math.max(0, normalMinDuration - buffer),
				maxDuration: normalMaxDuration + buffer
			},
			// Is the data skewed by outliers?
			hasOutliers: normalMaxDuration < maxDuration
		};
	}, [laps]);

	// Function to check if a lap is an outlier
	const isOutlier = useMemo(() => {
		const upperThreshold = durationRanges.normalRange.maxDuration;
		return (duration: number | null): boolean => {
			if (duration === null) return false;
			return duration > upperThreshold;
		};
	}, [durationRanges.normalRange.maxDuration]);

	// Find driver name and color
	const getDriverInfo = (driverNumber: number) => {
		const driver = drivers.find(d => d.driver_number === driverNumber);
		return {
			name: driver?.name_acronym || `D${driverNumber}`,
			color: driver?.team_colour ? `#${driver.team_colour}` : '#cccccc'
		};
	};

	// Format the data for Recharts, considering selected drivers
	const chartData = useMemo(() => {
		const data: { lapNumber: number;[key: string]: number | null | string }[] = [];

		// Initialize the data array with lap numbers
		for (let lap = lapRange.minLap; lap <= lapRange.maxLap; lap++) {
			data.push({ lapNumber: lap });
		}

		// Add lap times for selected drivers
		processedData.forEach((driverLaps, driverNumber) => {
			// Only include selected drivers
			if (!selectedDrivers.has(driverNumber)) {
				return;
			}

			const { name } = getDriverInfo(driverNumber);

			driverLaps.forEach(lap => {
				// Skip outliers if we're not showing them
				if (!showOutliers && lap.lap_duration !== null && isOutlier(lap.lap_duration)) {
					return;
				}

				const dataIndex = lap.lap_number - lapRange.minLap;
				if (dataIndex >= 0 && dataIndex < data.length) {
					data[dataIndex][name] = lap.lap_duration;
				}
			});
		});

		return data;
	}, [processedData, lapRange.minLap, lapRange.maxLap, showOutliers, isOutlier, selectedDrivers]);

	// Generate lines for selected drivers
	const driverLines = useMemo(() => {
		const lines: React.ReactNode[] = [];

		processedData.forEach((_, driverNumber) => {
			// Only include selected drivers
			if (!selectedDrivers.has(driverNumber)) {
				return;
			}
			const { name, color } = getDriverInfo(driverNumber);

			lines.push(
				<Line
					key={driverNumber}
					type="monotone"
					dataKey={name}
					stroke={color}
					activeDot={{ r: 8 }}
					connectNulls
					strokeWidth={2}
					dot={{ stroke: color, strokeWidth: 2, r: 4 }}
				/>
			);
		});

		return lines;
	}, [processedData, selectedDrivers]);

	// Handler for driver selection changes
	const handleDriverSelect = (driverNumber: number | 'all') => {
		setSelectedDrivers(prevSelected => {
			const newSelected = new Set(prevSelected);
			if (driverNumber === 'all') {
				// If "All Drivers" is checked, uncheck all. Otherwise, check all.
				if (newSelected.size === allDriverNumbers.length) {
					newSelected.clear();
				} else {
					allDriverNumbers.forEach(num => newSelected.add(num));
				}
			} else {
				// Toggle individual driver selection
				if (newSelected.has(driverNumber)) {
					newSelected.delete(driverNumber);
				} else {
					newSelected.add(driverNumber);
				}
			}
			return newSelected;
		});
	};

	// Determine if "All Drivers" should be checked
	const isAllSelected = selectedDrivers.size === allDriverNumbers.length && allDriverNumbers.length > 0;

	if (!processedData.size) {
		return <div className="text-gray-500 italic">No lap data available</div>;
	}

	// Create a custom tooltip formatter
	const CustomTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const filteredPayload = payload.filter((entry: { value: null | undefined; }) =>
				entry.value !== undefined && entry.value !== null
			);

			if (filteredPayload.length === 0) return null;

			return (
				<div className="bg-white p-3 border border-gray-200 shadow-md rounded">
					<p className="font-bold text-gray-700">{`Lap: ${label}`}</p>
					{filteredPayload.map((entry: any, index: number) => (
						<p key={index} style={{ color: entry.stroke }}>
							{`${entry.name}: ${Number(entry.value).toFixed(3)}s`}
						</p>
					))}
				</div>
			);
		}

		return null;
	};

	// Select the y-axis domain based on user preference
	const yAxisDomain = showOutliers
		? [Math.max(0, durationRanges.fullRange.minDuration * 0.99), durationRanges.fullRange.maxDuration * 1.01]
		: [durationRanges.normalRange.minDuration, durationRanges.normalRange.maxDuration];

	return (
		<div className="w-full overflow-x-auto">
			{/* Controls Row */}
			<div className="mb-2 ml-10 flex items-center justify-center space-x-4 relative">
				{/* Driver Selector Dropdown */}
				<div className="relative inline-block text-left" ref={dropdownRef}>
					<div>
						<button
							type="button"
							// Adjusted width class for consistency if needed, or rely on parent sizing
							className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm pl-3 pr-1 py-2 bg-white text-sm text-gray-700 hover:bg-gray-50 focus:outline-none"
							id="options-menu"
							aria-haspopup="true"
							aria-expanded={isSelectorOpen}
							onClick={() => setIsSelectorOpen(!isSelectorOpen)}
						>
							Select drivers
							{/* Heroicon name: solid/chevron-down */}
							<svg className="ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
							</svg>
						</button>
					</div>

					{isSelectorOpen && (
						<div
							className="origin-top-right absolute left-0 w-full rounded-md shadow-md bg-white border border-gray-300 focus:outline-none z-10 max-h-60 overflow-y-auto"
							role="menu"
							aria-orientation="vertical"
							aria-labelledby="options-menu"
						>
							<div className="py-1" role="none">
								{/* All Drivers Option */}
								<div className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer" onClick={() => handleDriverSelect('all')}>
									<input
										type="checkbox"
										checked={isAllSelected}
										readOnly
										className="mr-2"
									/>
									All / None
								</div>
								{/* Individual Driver Options */}
								{drivers.sort((a, b) => a.driver_number - b.driver_number).map(driver => {
									const { name, color } = getDriverInfo(driver.driver_number);
									const isSelected = selectedDrivers.has(driver.driver_number);
									return (
										<div key={driver.driver_number} className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer" onClick={() => handleDriverSelect(driver.driver_number)}>
											<input
												type="checkbox"
												checked={isSelected}
												readOnly
												className="mr-2"
											/>
											<span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></span>
											{driver.name_acronym || name}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* Outlier Toggle */}
				{durationRanges.hasOutliers && (
					<label className="flex items-center text-sm">
						<input
							type="checkbox"
							checked={showOutliers}
							onChange={() => setShowOutliers(!showOutliers)}
							className="mr-2"
						/>
						Show outlier laps
					</label>
				)}
			</div>
			{/* Chart Area */}
			<div className="w-full h-[400px] bg-white p-4">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={chartData}
						margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis
							dataKey="lapNumber"
							label={{ value: 'Lap', position: 'insideBottomRight', offset: -5 }}
						/>
						<YAxis
							domain={yAxisDomain}
							label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', offset: -5 }}
							tickFormatter={(value) => value.toFixed(1)}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Legend />
						{driverLines}
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
};
