import React, { type ChangeEvent } from 'react';
import type { DriverInterval } from '~/types';
import { Settings } from './settings';
import { useStore } from '@tanstack/react-store';
import { f1Store } from '~/store/f1-store';

interface NavProps {
    selectedPenalty: number;
    handlePenaltyChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    selectedDriver?: string | null;
    handleDriverChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    drivers: DriverInterval[];
}

export const Nav: React.FC<NavProps> = ({ selectedPenalty, handlePenaltyChange, selectedDriver, handleDriverChange, drivers }) => {
    const { session, lapCount, trackStatus, weatherData } = useStore(f1Store, (state) => ({
        session: state.sessionInfo,
        lapCount: state.lapCount,
        trackStatus: state.trackStatus,
        weatherData: state.weatherData,
    }));

    if (!session) {
        return <div className="p-2 text-zinc-500 dark:text-zinc-400">No session data available.</div>;
    }

    return (
        <div className="lg:flex bg-zinc-200 dark:bg-black text-zinc-800 dark:text-zinc-200 h-full">
            <div className="lg:w-1/5 flex flex-row justify-between items-center p-2 lg:px-2 lg:border border-zinc-300 dark:border-zinc-700">
                <p className='text-sm lg:text-base font-bold'>
                    {session?.Meeting.Location} - {session?.Name}
                </p>
                <p className='text-sm lg:text-base font-bold'>
                    {trackStatus
                        ? (trackStatus.Status === "1"
                            ? "Green"
                            : trackStatus.Message)
                        : ""}
                </p>
                <p className='text-sm lg:text-base font-bold'>
                    {lapCount ? `Lap ${lapCount.CurrentLap} / ${lapCount.TotalLaps}` : ""}
                </p>
            </div>
            <div className="lg:w-4/5 flex flex-wrap items-center justify-center lg:justify-around p-2 lg:p-0">
                <div className="hidden lg:flex flex-grow" />
                {weatherData && (
                    <div className="w-full lg:w-auto flex flex-wrap justify-center text-sm my-1 lg:my-0 lg:mr-10">
                        <p className="mr-2">
                            <span className="font-semibold">Air:</span> {weatherData.AirTemp}°C
                        </p>
                        <p className="mr-2">
                            <span className="font-semibold">Track:</span> {weatherData.TrackTemp}°C
                        </p>
                        <p className="mr-2">
                            <span className="font-semibold">Rain:</span> {weatherData.Rainfall === "1" ? "Yes" : "No"}
                        </p>
                        <p>
                            <span className="font-semibold">Wind:</span> {weatherData.WindSpeed} m/s
                        </p>
                    </div>
                )}
                {/* Driver and Penalty selectors */}
                <div className="w-full lg:w-auto flex justify-center items-center my-1 lg:my-0">
                    <select
                        className="cursor-pointer mr-1 border text-sm border-zinc-300 dark:border-zinc-600 rounded-md p-1 pr-5 bg-white dark:bg-black focus:outline-none text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 shadow-md"
                        value={selectedDriver || ""}
                        onChange={handleDriverChange}
                    >
                        <option value="">Pit driver</option>
                        {drivers
                            .filter(driver => driver.gapInSeconds !== Infinity && !driver.name.includes('(Pit)'))
                            .map((driver, index) => (
                                <option key={index} value={driver.name}>
                                    {driver.name}
                                </option>
                            ))}
                    </select>
                    <select
                        className="cursor-pointer border text-sm border-zinc-300 dark:border-zinc-600 rounded-md p-1 pr-5 bg-white dark:bg-black focus:outline-none text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 shadow-md"
                        value={selectedPenalty}
                        onChange={handlePenaltyChange}
                    >
                        <option value={0}>No Penalty</option>
                        <option value={5}>+5s</option>
                        <option value={10}>+10s</option>
                        <option value={15}>+15s</option>
                        <option value={20}>+20s</option>
                        <option value={25}>+25s</option>
                    </select>
                    <div className="ml-4 lg:hidden">
                        <Settings />
                    </div>
                </div>
                <div className="hidden lg:flex flex-grow" />
                <div className="ml-4 hidden lg:block">
                    <Settings />
                </div>
            </div>
        </div>
    );
};