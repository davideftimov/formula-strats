import React from 'react';
import type { DriverInterval } from '~/types';

interface RankingsProps {
	drivers: DriverInterval[];
}

const getCompoundStyle = (compound: string): React.CSSProperties => {
	switch (compound?.toUpperCase()) {
		case 'SOFT':
			return { color: '#EF4444' };
		case 'MEDIUM':
			return { color: '#EAB308' };
		case 'HARD':
			return { color: '#9F9FA9' };
		case 'INTERMEDIATE':
			return { color: '#22C55E' };
		case 'WET':
			return { color: '#3B82F6' };
		default:
			return { color: '#E4E4E7' };
	}
};

export const Rankings: React.FC<RankingsProps> = ({ drivers }) => {
	if (!drivers || drivers.length === 0) {
		return null
	}

	return (
		<div className="flex flex-col h-full justify-start">
			<div>
				<div className="max-w-full">
					<table className="bg-white dark:bg-black w-full">
						<tbody>
							{drivers.map((driver, index) => {
								const baseRowClass = index % 2 === 0 ? 'bg-zinc-50 dark:bg-black' : 'bg-white dark:bg-black';
								const textStyleClass = driver.isSpecialStatus ? 'italic text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100';
								return (
									<tr
										key={driver.racingNumber}
										className={`${baseRowClass} ${textStyleClass}`}
									>
										<td className="py-1 px-2 border-zinc-200 dark:border-zinc-700 w-12">{index + 1}</td>
										<td className="py-1 px-2 border-zinc-200 dark:border-zinc-700">
											<div className="flex items-center">
												<div
													className="w-3 h-3 rounded-full mr-1"
													style={{ backgroundColor: driver.color }}
												/>
												<span>{driver.name}</span>
											</div>
										</td>
										<td className="py-1 px-2 border-zinc-200 dark:border-zinc-700">
											<div className="flex items-center text-xs space-x-1.5">
												{driver.stints?.map((stint, i) => (
													<span key={i} style={getCompoundStyle(stint.Compound)} className="font-semibold">
														{stint.Compound.toUpperCase() === 'UNKNOWN' ? ('?') : (stint.Compound.charAt(0))}
														<span className="font-normal text-zinc-500 dark:text-zinc-400">{stint.TotalLaps}</span>
													</span>
												))}
											</div>
										</td>
										<td className="py-1 px-2 border-zinc-200 dark:border-zinc-700 text-right w-28">
											{driver.gapDisplay}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};
