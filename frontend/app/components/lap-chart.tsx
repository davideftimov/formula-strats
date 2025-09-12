import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Lap, DriverData } from '~/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LapChartProps {
	laps: Lap[];
	drivers: DriverData;
}

function parseTimeToSeconds(timeStr: string): number {
	const cleanStr = timeStr.trim().replace(/^[+-]/, '');

	if (cleanStr.includes(':')) {
		// Format is mm:ss.mmm or m:ss.mmm
		const [minutes, rest] = cleanStr.split(':');
		const [seconds, milliseconds = '0'] = rest.split('.');
		return (
			parseInt(minutes) * 60 +
			parseInt(seconds) +
			parseFloat('0.' + milliseconds)
		);
	} else {
		// Format is just seconds.mmm
		return parseFloat(cleanStr);
	}
}

export const LapChart: React.FC<LapChartProps> = ({ laps, drivers }) => {
	const [showOutliers, setShowOutliers] = useState(false);
	const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setSelectedDrivers(new Set(Object.keys(drivers)));
	}, [drivers]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsSelectorOpen(false);
			}
		};

		if (isSelectorOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isSelectorOpen]);

	const allDriverNumbers = useMemo(() => Object.keys(drivers), [drivers]);

	const processedData = useMemo(() => {
		const lapsByDriver = new Map<string, Lap[]>();

		if (!laps.length) return lapsByDriver;

		laps.forEach(lap => {
			if (!lapsByDriver.has(lap.RacingNumber)) {
				lapsByDriver.set(lap.RacingNumber, []);
			}
			lapsByDriver.get(lap.RacingNumber)?.push(lap);
		});

		lapsByDriver.forEach((driverLaps) => {
			driverLaps.sort((a, b) => a.LapNumber - b.LapNumber);
		});

		return lapsByDriver;
	}, [laps]);

	// Get min and max lap numbers to determine chart width
	const lapRange = useMemo(() => {
		let minLap = Infinity;
		let maxLap = 0;

		laps.forEach(lap => {
			minLap = Math.min(minLap, lap.LapNumber);
			maxLap = Math.max(maxLap, lap.LapNumber);
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
			const lap_s = parseTimeToSeconds(lap.LapTime);
			if (lap_s !== null) {
				durations.push(lap_s);
				minDuration = Math.min(minDuration, lap_s);
				maxDuration = Math.max(maxDuration, lap_s);
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

	const isOutlier = useMemo(() => {
		const upperThreshold = durationRanges.normalRange.maxDuration;
		return (duration: number | null): boolean => {
			if (duration === null) return false;
			return duration > upperThreshold;
		};
	}, [durationRanges.normalRange.maxDuration]);

	const getDriverInfo = (driverRacingNumber: string) => {
		const driver = drivers[driverRacingNumber];
		return {
			name: driver?.Tla || `D${driverRacingNumber}`,
			color: driver?.TeamColour ? `#${driver.TeamColour}` : '#cccccc'
		};
	};

	const chartData = useMemo(() => {
		const data: { lapNumber: number;[key: string]: number | null | string }[] = [];

		// Initialize the data array with lap numbers
		for (let lap = lapRange.minLap; lap <= lapRange.maxLap; lap++) {
			data.push({ lapNumber: lap });
		}

		// Add lap times for selected drivers
		processedData.forEach((driverLaps, driverRacingNumber) => {
			if (!selectedDrivers.has(driverRacingNumber)) {
				return;
			}

			const { name } = getDriverInfo(driverRacingNumber);

			driverLaps.forEach(lap => {
				const lap_s = parseTimeToSeconds(lap.LapTime);
				if (!showOutliers && lap_s !== null && isOutlier(lap_s)) {
					return;
				}

				const dataIndex = lap.LapNumber - lapRange.minLap;
				if (dataIndex >= 0 && dataIndex < data.length) {
					data[dataIndex][name] = lap_s;
				}
			});
		});

		return data;
	}, [processedData, lapRange.minLap, lapRange.maxLap, showOutliers, isOutlier, selectedDrivers, getDriverInfo]);

	const driverLines = useMemo(() => {
		const lines: React.ReactNode[] = [];

		processedData.forEach((_, driverRacingNumber) => {
			if (!selectedDrivers.has(driverRacingNumber)) {
				return;
			}
			const { name, color } = getDriverInfo(driverRacingNumber);

			lines.push(
				<Line
					key={driverRacingNumber}
					type="monotone"
					dataKey={name}
					stroke={color}
					activeDot={{ stroke: color, strokeWidth: 4, r: 4 }}
					connectNulls
					strokeWidth={2}
					dot={{ stroke: color, strokeWidth: 4, r: 1 }}
				/>
			);
		});

		return lines;
	}, [processedData, selectedDrivers, getDriverInfo]);

	const handleDriverSelect = (driverRacingNumber: string | 'all') => {
		setSelectedDrivers(prevSelected => {
			const newSelected = new Set(prevSelected);
			if (driverRacingNumber === 'all') {
				if (newSelected.size === allDriverNumbers.length) {
					newSelected.clear();
				} else {
					allDriverNumbers.forEach(num => newSelected.add(num));
				}
			} else {
				if (newSelected.has(driverRacingNumber)) {
					newSelected.delete(driverRacingNumber);
				} else {
					newSelected.add(driverRacingNumber);
				}
			}
			return newSelected;
		});
	};

	const isAllSelected = selectedDrivers.size === allDriverNumbers.length && allDriverNumbers.length > 0;

	if (!processedData.size) {
		return <div className="text-gray-500 dark:text-gray-400 italic">No lap data available</div>;
	}

	const CustomTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const filteredPayload = payload.filter((entry: { value: null | undefined; }) =>
				entry.value !== undefined && entry.value !== null
			);

			if (filteredPayload.length === 0) return null;

			filteredPayload.sort((a: any, b: any) => a.value - b.value);

			// Determine grid columns class based on number of items
			const gridColsClass = filteredPayload.length > 12 ? 'grid-cols-3' :
				filteredPayload.length > 6 ? 'grid-cols-2' : 'grid-cols-1';

			return (
				<div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-md rounded max-h-60 overflow-y-auto">
					<p className="font-bold text-gray-700 dark:text-gray-300 mb-2">{`Lap: ${label}`}</p>
					<div className={`grid ${gridColsClass} gap-x-4 gap-y-1`}>
						{filteredPayload.map((entry: any, index: number) => (
							<p key={index} className="text-sm whitespace-nowrap" style={{ color: entry.stroke }}>
								{`${entry.name}: ${Number(entry.value).toFixed(3)}s`}
							</p>
						))}
					</div>
				</div>
			);
		}

		return null;
	};

	const yAxisDomain = showOutliers
		? [Math.max(0, durationRanges.fullRange.minDuration * 0.99), durationRanges.fullRange.maxDuration * 1.01]
		: [durationRanges.normalRange.minDuration, durationRanges.normalRange.maxDuration];

	return (
		<div className="w-full h-full flex flex-col">
			{/* Controls Row */}
			<div className="mb-2 ml-10 flex items-center justify-center space-x-4 relative">
				{/* Driver Selector Dropdown */}
				<div className="relative inline-block text-left" ref={dropdownRef}>
					<div>
						<button
							type="button"
							// Adjusted width class for consistency if needed, or rely on parent sizing
							className="inline-flex justify-center w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm pl-3 pr-1 py-2 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
							id="options-menu"
							aria-haspopup="true"
							aria-expanded={isSelectorOpen}
							onClick={() => setIsSelectorOpen(!isSelectorOpen)}
						>
							Select drivers
							{/* Heroicon name: solid/chevron-down */}
							<svg className="ml-2 h-5 w-5 text-gray-700 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
							</svg>
						</button>
					</div>

					{isSelectorOpen && (
						<div
							className="origin-top-right absolute left-0 w-full rounded-md shadow-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none z-10 max-h-60 overflow-y-auto"
							role="menu"
							aria-orientation="vertical"
							aria-labelledby="options-menu"
						>
							<div className="py-1" role="none">
								{/* All Drivers Option */}
								<div className="flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => handleDriverSelect('all')}>
									<input
										type="checkbox"
										checked={isAllSelected}
										readOnly
										className="mr-2 form-checkbox text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400"
									/>
									All / None
								</div>
								{/* Individual Driver Options */}
								{Object.values(drivers)
									.sort((a, b) => Number(a.RacingNumber) - Number(b.RacingNumber))
									.map(driverDetail => {
										const driverRacingNumberStr = driverDetail.RacingNumber;
										const { name, color } = getDriverInfo(driverRacingNumberStr);
										const isSelected = selectedDrivers.has(driverRacingNumberStr);
										return (
											<div key={driverRacingNumberStr} className="flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => handleDriverSelect(driverRacingNumberStr)}>
												<input
													type="checkbox"
													checked={isSelected}
													readOnly
													className="mr-2 form-checkbox text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400"
												/>
												<span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></span>
												{driverDetail.Tla || name}
											</div>
										);
									})}
							</div>
						</div>
					)}
				</div>

				{/* Outlier Toggle */}
				{durationRanges.hasOutliers && (
					<label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
						<input
							type="checkbox"
							checked={showOutliers}
							onChange={() => setShowOutliers(!showOutliers)}
							className="mr-2 form-checkbox text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400"
						/>
						Show outlier laps
					</label>
				)}
			</div>
			{/* Chart Area */}
			<div className="flex-1 w-full bg-white dark:bg-gray-900">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={chartData}
						margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
					>
						<CartesianGrid strokeDasharray="5 5" stroke="#4B5563" /> {/* gray-600 */}
						<XAxis
							dataKey="lapNumber"
							label={{ value: 'Lap', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF' }} // gray-400
							stroke="#9CA3AF"
							tick={{ fill: '#9CA3AF' }}
						/>
						<YAxis
							domain={yAxisDomain}
							label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', offset: -5, fill: '#9CA3AF' }}
							stroke="#9CA3AF"
							tickFormatter={(value) => value.toFixed(1)}
							tick={{ fill: '#9CA3AF' }}
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
