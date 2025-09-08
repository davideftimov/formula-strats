import React, { type ChangeEvent } from 'react';
import type { SessionInfo, LapCount, TrackStatus, WeatherData } from '~/types';
import type { DriverInterval } from '~/types/driver-interval';
import { Settings } from './settings';

interface NavProps {
    session: SessionInfo | null;
    lapCount: LapCount | null;
    weatherData: WeatherData | null;
    trackStatus?: TrackStatus | null;
    selectedPenalty: number;
    handlePenaltyChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    selectedDriver?: string | null;
    handleDriverChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    drivers: DriverInterval[];
}

export const Nav: React.FC<NavProps> = ({ session, lapCount, trackStatus, weatherData, selectedPenalty, handlePenaltyChange, selectedDriver, handleDriverChange, drivers }) => {
    if (!session) {
        return <div className="p-2 text-gray-500 dark:text-gray-400">No session data available.</div>;
    }

    return (
        <div className="lg:flex bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 h-full">
            <div className="lg:w-1/5 flex flex-row justify-between items-center">
                <p className='text- font-bold'>
                    {session?.Meeting.Location} - {session?.Name}
                </p>
                <p className='text- font-bold'>
                    {lapCount ? `Lap ${lapCount.CurrentLap} / ${lapCount.TotalLaps}` : ""}
                </p>
                <p className='text- font-bold'>
                    {trackStatus
                        ? (trackStatus.Status === "1"
                            ? "Green"
                            : trackStatus.Message)
                        : ""}
                </p>
            </div>
            <div className="lg:w-4/5 ml-2 flex items-center justify-around">
                <div className="flex-grow" />
                {weatherData && (
                    <div className="flex text-sm mr-10">
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
                            <span className="font-semibold">Wind:</span> {weatherData.WindSpeed} km/h
                        </p>
                    </div>
                )}
                {/* Driver and Penalty selectors */}
                <div>
                    <select
                        className="mr-1 border text-sm border-gray-300 dark:border-gray-600 rounded-md p-1 pr-5 bg-white dark:bg-gray-800 focus:outline-none text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-md"
                        value={selectedDriver || ""}
                        onChange={handleDriverChange}
                    >
                        <option value="">Pit driver</option>
                        {drivers
                            .filter(driver => driver.gapInSeconds !== -1 && !driver.name.includes('(Pit)'))
                            .map((driver, index) => (
                                <option key={index} value={driver.name}>
                                    {driver.name}
                                </option>
                            ))}
                    </select>
                    <select
                        className="border text-sm border-gray-300 dark:border-gray-600 rounded-md p-1 pr-5 bg-white dark:bg-gray-800 focus:outline-none text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-md"
                        value={selectedPenalty}
                        onChange={handlePenaltyChange}
                    // disabled={!selectedDriver}
                    >
                        <option value={0}>No Penalty</option>
                        <option value={5}>+5s</option>
                        <option value={10}>+10s</option>
                        <option value={15}>+15s</option>
                        <option value={20}>+20s</option>
                        <option value={25}>+25s</option>
                    </select>
                </div>
                <div className="flex-grow" />
                <div className="ml-4">
                    <Settings />
                </div>
            </div>
        </div>
    );
};