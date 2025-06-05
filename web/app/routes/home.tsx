import type { Route } from "./+types/home";
import { DriverTimeline } from "~/components/driver-timeline";
import { Footer } from "~/components/footer";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchMeetings, fetchDrivers, fetchDriverTrackerData, fetchLapData } from '../services/F1Service';
// import type { ProcessedInterval } from '../types/OpenF1Types/interval';
import type { Meeting, DriverData, DriverDetails, DriverTracker, Lap, SessionInfo, TimingData } from '~/types';
import { LapChart } from '~/components/lap-chart';
import { DriverRankings } from '~/components/driver-rankings';
import type { DriverInterval } from '~/types/driver-interval';
import { useSettings } from '~/components/settings';
import { logger } from '../utils/logger';
import useSSE from '~/hooks/useSSE';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Formula Strats" },
    { name: "description", content: "The favorite app of all formula armchair strategists." },
  ];
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

function parseTimeToSeconds(timeStr: string): number {
  // Remove leading '+' or '-' if present
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

export default function Home() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [driverData, setDriverData] = useState<DriverData>({});
  const [driverIntervals, setDriverIntervals] = useState<DriverInterval[]>([]);
  const [timingData, setTimingData] = useState<TimingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // const [error, setError] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedPenalty, setSelectedPenalty] = useState<number>(0); // Add state for penalty
  const [lapData, setLapData] = useState<Lap[]>([]);
  const [raceFinished, setRaceFinished] = useState<boolean>(false);
  const { delay } = useSettings(); // Use global delay from settings context
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Replace with your actual SSE endpoint URL
  const sseUrl = 'http://localhost:8000/f1-stream/'; // Example URL, ensure this endpoint exists and works

  const handleSessionInfo = useCallback((data: SessionInfo | null) => {
    console.log('Received Session Info:', data);
    setSession(data);
  }, []);

  const handleLapData = useCallback((data: Lap[] | null) => {
    console.log('Received Lap Data:', data);
    if (data === null) {
      setLapData([]);
    } else {
      setLapData(prevData => [...(prevData || []), ...data]);
    }
  }, []);

  const handleDriverData = useCallback((data: DriverData | null) => {
    console.log('Received Driver Data:', data);
    if (data === null) {
      setDriverData({});
    } else {
      setDriverData(prevData => {
        const newData = { ...(prevData || {}) };
        for (const key in data) {
          newData[key] = {
            ...(prevData?.[key] || {}),
            ...data[key],
          };
        }
        return newData;
      });
    }
  }, []);

  const handleTimingData = useCallback((data: TimingData | null) => {
    console.log('Received Timing Data:', data);
    if (data === null) {
      setTimingData(null);
    } else {
      setTimingData(prevData => {
        const newTimingData = {
          ...(prevData || {}),
          ...data, // Spread top-level properties from new data
          Lines: {
            ...(prevData?.Lines || {}),
          },
        };

        if (data.Lines) {
          for (const key in data.Lines) {
            newTimingData.Lines[key] = {
              ...(prevData?.Lines?.[key] || {}),
              ...data.Lines[key],
            };
          }
        }
        return newTimingData;
      });
    }
  }, []);

  const { error, isConnected } = useSSE({
    url: sseUrl,
    onSessionInfo: handleSessionInfo,
    onDriverData: handleDriverData,
    onTimingData: handleTimingData,
    onLapData: handleLapData,
  });

  // Fetch intervals and laps data when session is available
  useEffect(() => {
    if (!session || !driverData || !timingData || !timingData.Lines) {
      setDriverIntervals([]);
      if (session && driverData && timingData && !timingData.Lines) {
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    const driverKeys = Object.keys(timingData.Lines);
    if (driverKeys.length === 0) {
      setDriverIntervals([]);
      setLoading(false);
      return;
    }

    const mappedDrivers: DriverInterval[] = driverKeys.map(driverKey => {
      const driverTimingInfo = timingData.Lines[driverKey];
      const driverDetails = driverData[driverKey];

      let gapToLeaderStr = driverTimingInfo.GapToLeader;
      let isLapped = false;
      let lapsDown = 0;

      let gapInSeconds: number | null = null;

      if (driverTimingInfo.Position === "1") {
        gapInSeconds = null;
      } else if (gapToLeaderStr) {
        if (gapToLeaderStr.includes('L') && gapToLeaderStr.includes('+')) {
          isLapped = true;
          gapInSeconds = Number.MAX_VALUE;
          const lapMatch = gapToLeaderStr.match(/(\d+)\s*(?:L|LAP)/i);
          if (lapMatch && lapMatch[1]) {
            lapsDown = parseInt(lapMatch[1], 10);
          } else if (gapToLeaderStr.toUpperCase().includes('LAP')) {
            lapsDown = 1;
          }
        } else {
          try {
            gapInSeconds = parseTimeToSeconds(gapToLeaderStr);
          } catch (e) {
            logger.warn(`Could not parse GapToLeader for driver ${driverKey}: ${gapToLeaderStr}`, e);
            gapInSeconds = Number.MAX_VALUE;
          }
        }
      } else {
        isLapped = true;
        lapsDown = 99;
        gapInSeconds = Number.MAX_VALUE;
        logger.warn(`GapToLeader is missing for driver ${driverKey} (Position: ${driverTimingInfo.Position})`);
      }

      const name = driverDetails?.Tla || `D${driverTimingInfo.RacingNumber}`;
      let color = '#CCCCCC';
      if (driverDetails?.TeamColour) {
        color = driverDetails.TeamColour.startsWith('#') ? driverDetails.TeamColour : `#${driverDetails.TeamColour}`;
      }

      return {
        name: name,
        racingNumber: driverTimingInfo.RacingNumber,
        color: color,
        gapToLeader: gapInSeconds,
        isLapped: isLapped,
        lapsDown: lapsDown
      };
    });

    logger.log("mappedDrivers", mappedDrivers);
    logger.log("selectedDriver", selectedDriver);

    // Add simulated position after pit stop for selected driver
    if (selectedDriver) {
      const driverToPit = mappedDrivers.find(d => d.name === selectedDriver);
      if (driverToPit) {
        // Get pit time lost for current circuit
        const circuitName = session.Meeting.Circuit.ShortName || '';
        const pitTimeLostData = circuitAvgPitTimeLost.find(c => c.circuit_short_name === circuitName);
        // Add selected penalty to pit time lost
        const pitTimeLost = (pitTimeLostData ? pitTimeLostData.green_flag : 20) + selectedPenalty;

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

    // Sort by position (leader first, not lapped by gap, lapped drivers last by laps down)
    const sortedDrivers = mappedDrivers.sort((a, b) => {
      if (a.gapToLeader === null) return -1;
      if (b.gapToLeader === null) return 1;
      if (a.isLapped && !b.isLapped) return 1;
      if (!a.isLapped && b.isLapped) return -1;
      if (a.isLapped && b.isLapped) {
        if ((a.lapsDown ?? 0) !== (b.lapsDown ?? 0)) {
          return (a.lapsDown ?? 0) - (b.lapsDown ?? 0);
        }
        return 0;
      }
      return (a.gapToLeader as number) - (b.gapToLeader as number);
    });

    setDriverIntervals(sortedDrivers);
    setLoading(false);


    // Clean up
    return () => {
    };
  }, [session, timingData, driverData, selectedDriver, selectedPenalty, delay]); // Add delay to dependency array

  if (loading) {
    return <div className="w-full p-5 my-5 font-sans text-gray-700 dark:text-gray-300">Loading driver data...</div>;
  }

  if (error) {
    return <div className="w-full p-5 my-5 font-sans text-red-500 dark:text-red-400">Error: </div>;
  }

  if (isStarting) {
    return <div className="w-full p-5 my-5 font-sans text-gray-700 dark:text-gray-300">The race is starting...</div>;
  }

  return (
    <>
      <div className="w-full lg:h-[100vh] font-sans">
        {/* Two-column layout container */}
        <div className="lg:flex"> {/* h-full */}
          {/* Left column - Driver Rankings */}
          <div className="lg:w-1/5 flex flex-col h-full justify-start border-r border-gray-200 dark:border-gray-700">
            {driverIntervals.length > 0 && (
              <DriverRankings
                drivers={driverIntervals}
                session={session}
                raceFinished={raceFinished}
                lapsData={lapData}
              />
            )}
          </div>

          {/* Right column - Selectors, Timeline, and Charts */}
          <div className="lg:w-4/5">
            {/* Driver timeline */}
            {driverIntervals.length > 0 && (
              <div className='px-6 h-[35vh] pt-2'>
                {/* Driver and Penalty selectors */}
                <div className="bg-transparent flex flex-row items-center justify-center ml-2 space-x-2">
                  <select
                    className="border text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 pr-5 bg-white dark:bg-gray-800 focus:outline-none text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-md"
                    value={selectedDriver || ""}
                    onChange={(e) => setSelectedDriver(e.target.value || null)}
                  >
                    <option value="">Pit driver</option>
                    {driverIntervals
                      .filter(driver => !driver.name.includes('(Pit)')) // Exclude simulated driver from pit selection
                      .map((driver, index) => (
                        <option key={index} value={driver.name}>
                          {driver.name}
                        </option>
                      ))}
                  </select>
                  {/* Penalty Selector */}
                  <select
                    className="border text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 pr-5 bg-white dark:bg-gray-800 focus:outline-none text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-md"
                    value={selectedPenalty}
                    onChange={(e) => setSelectedPenalty(Number(e.target.value))}
                    disabled={!selectedDriver} // Disable if no driver is selected
                  >
                    <option value={0}>No Penalty</option>
                    <option value={5}>+5s</option>
                    <option value={10}>+10s</option>
                    <option value={15}>+15s</option>
                    <option value={20}>+20s</option>
                    <option value={25}>+25s</option>
                  </select>
                </div>
                <DriverTimeline drivers={driverIntervals} />
              </div>
            )}

            {/* Lap Chart */}
            {lapData.length > 0 && (
              <div className="ml-2 h-[65vh]">
                <LapChart laps={lapData} drivers={driverData} />
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
