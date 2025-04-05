import React, { useMemo, useState } from 'react';
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

	// Process lap data
	const processedData = useMemo(() => {
		// Always initialize as Map, not array
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

	// Format the data for Recharts
	const chartData = useMemo(() => {
		const data: { lapNumber: number;[key: string]: number | null | string }[] = [];

		// Initialize the data array with lap numbers
		for (let lap = lapRange.minLap; lap <= lapRange.maxLap; lap++) {
			data.push({ lapNumber: lap });
		}

		// Add lap times for each driver
		processedData.forEach((driverLaps, driverNumber) => {
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
	}, [processedData, lapRange.minLap, lapRange.maxLap, showOutliers, isOutlier]);

	// Generate lines for each driver
	const driverLines = useMemo(() => {
		const lines: React.ReactNode[] = [];

		processedData.forEach((_, driverNumber) => {
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
	}, [processedData]);

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
			{durationRanges.hasOutliers && (
				<div className="mb-2 flex items-center">
					<label className="flex items-center text-sm">
						<input
							type="checkbox"
							checked={showOutliers}
							onChange={() => setShowOutliers(!showOutliers)}
							className="mr-2"
						/>
						Show outlier laps (very slow laps)
					</label>
				</div>
			)}
			<div className="w-full h-[350px] border border-gray-200 rounded-lg shadow-sm bg-white p-4">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={chartData}
						margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis
							dataKey="lapNumber"
						// label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -5 }}
						/>
						<YAxis
							domain={yAxisDomain}
						// label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft', offset: -5 }}
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
