import React from 'react';
import type { DriverInterval } from '~/types';

interface TimelineProps {
	drivers: DriverInterval[];
}

export const Timeline: React.FC<TimelineProps> = ({ drivers }) => {
	if (!drivers || drivers.length === 0) {
		return null;
	}

	// Find the maximum gap to scale the visualization appropriately
	const maxGap = drivers.length > 0
		? Math.max(
			...drivers
				.filter((driver) => driver.gapInSeconds !== Infinity)
				.map((driver) => driver.gapInSeconds as number)
		)
		: 0;

	return (
		<div className="relative w-full">
			{/* Horizontal line */}
			<div className="absolute top-10 left-0 w-full h-0.5 bg-zinc-300 dark:bg-zinc-600"></div>

			{/* Driver dots and labels */}
			{(() => {
				// Filter non-lapped drivers and calculate positions
				const timelineDrivers = drivers.filter(d => d.gapInSeconds !== Infinity);
				const driverPositions = timelineDrivers.map((driver, index) => {
					const position = driver.gapInSeconds === null
						? 100  // Leader at the right edge
						: Math.max(0, Math.min(100, 100 - ((driver.gapInSeconds / maxGap) * 100))); // Scale to 95% to avoid edge overlap

					return {
						driver,
						position,
						index
					};
				});

				// Assign rows to drivers to avoid label overlap
				const MIN_LABEL_WIDTH = 3; // Estimated minimum width percentage for a label
				const rowAssignments: number[] = new Array(driverPositions.length).fill(0);

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
				return driverPositions.map((driverPos, index) => {
					const position = driverPos.position;
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
								className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-800 shadow-md"
								style={{ backgroundColor: driverPos.driver.color }}
							/>

							{/* Connecting line */}
							<div
								style={{
									position: 'absolute',
									left: '50%',
									top: '100%',
									width: '2px',
									height: `${lineHeight}px`,
									backgroundColor: driverPos.driver.color,
									transform: 'translateX(-50%)',
								}}
							/>

							{/* Driver name */}
							<div
								className="absolute px-1.5 py-0.5 rounded font-bold whitespace-nowrap z-10 text-sm bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100"
								style={{
									top: `${lineHeight + 5}px`,
									left: '50%',
									transform: 'translateX(-50%)',
									border: `1px solid ${driverPos.driver.color}`,
								}}
							>
								{driverPos.driver.name}
							</div>
						</div>
					);
				});
			})()}
		</div>
	);
};