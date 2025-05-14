import React from 'react';
import type { Session } from '~/types/session';
import type { Lap } from '~/types/lap';
import type { DriverInterval } from '~/types/driver-interval';

interface DriverRankingsProps {
	drivers: DriverInterval[];
	session: Session | null;
	raceFinished: boolean;
	lapsData: Lap[];
}

export const DriverRankings: React.FC<DriverRankingsProps> = ({ drivers, session, raceFinished, lapsData }) => {
	if (!drivers || drivers.length === 0) {
		return <div className="p-2 text-gray-500 dark:text-gray-400">No driver data available.</div>;
	}

	return (
		<div className="flex flex-col h-full justify-start">
			<div className="flex flex-row justify-between bg-gray-200 dark:bg-gray-700 px-2 py-1 text-gray-800 dark:text-gray-200">
				<h1 className='text- font-bold'>
					{session?.location} - {session?.session_name}
				</h1>
				<h1 className='text- font-bold'>
					{raceFinished ? "FINISHED" : lapsData.length > 0 ? `Lap ${lapsData[lapsData.length - 1].lap_number}` : ""}
				</h1>
			</div>
			<div>
				<div className="max-w-full">
					<table className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm w-full">
						{/* Optional: Add back the header if desired */}
						{/* <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                                <th className="py-1 px-2 border-b border-gray-200 dark:border-gray-600 text-left w-12">Pos</th>
                                <th className="py-1 px-2 border-b border-gray-200 dark:border-gray-600 text-left">Driver</th>
                                <th className="py-1 px-2 border-b border-gray-200 dark:border-gray-600 text-right w-20">Gap</th>
                            </tr>
                        </thead> */}
						<tbody>
							{drivers.map((driver, index) => (
								<tr
									key={index}
									className={`${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'} ${driver.name.includes('(Pit)') ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}
								>
									<td className="py-1 px-2 border-b border-gray-200 dark:border-gray-700">{index + 1}</td>
									<td className="py-1 px-2 border-b border-gray-200 dark:border-gray-700">
										<div className="flex items-center">
											<div
												className="w-3 h-3 rounded-full mr-1"
												style={{ backgroundColor: driver.color }}
											/>
											<span>{driver.name}</span>
										</div>
									</td>
									<td className="py-1 px-2 border-b border-gray-200 dark:border-gray-700 text-right">
										{driver.gapToLeader === null ? 'Leader' : driver.isLapped ? `${driver.lapsDown}L` : `+${driver.gapToLeader.toFixed(3)}s`}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};
