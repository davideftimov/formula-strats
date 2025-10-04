import React from 'react';
import { useStore } from '@tanstack/react-store';
import { f1Store } from '~/store/f1-store';

export const RaceControlMessages: React.FC = () => {
	const messages = useStore(f1Store, (state) => state.raceControlMessages?.Messages);

	if (!messages || messages.length === 0) {
		return null;
	}

	const reversedMessages = [...messages].reverse();

	return (
		<div className="flex flex-col h-full justify-start text-sm">
			<div>
				<div className="max-w-full">
					<table className="bg-white dark:bg-black shadow-sm w-full">
						<tbody>
							{reversedMessages.map((message, index) => (
								<tr
									key={index}
									className={index % 2 === 0 ? 'bg-zinc-50 dark:bg-black' : 'bg-white dark:bg-black'}
								>
									<td className="py-1 px-2 border-zinc-200 dark:border-zinc-700 align-top">
										{message.Lap && <div>L{message.Lap}</div>}
										<div>{new Date(`${message.Utc}Z`).toLocaleTimeString([], { hour12: false })}</div>
									</td>
									<td className="py-1 px-2 border-zinc-200 dark:border-zinc-700">
										{message.Message}
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
