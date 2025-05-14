import type { Route } from "./+types/home";
import { DriverTimeline } from "~/components/driver-timeline";
import { Footer } from "~/components/footer";
import React, { useState, useEffect, useRef } from 'react';
import { fetchIntervals, fetchSessions, fetchDrivers, processIntervalData, fetchLaps } from '../services/OpenF1Service';
import type { Driver as ApiDriver } from '../types/driver';
import type { ProcessedInterval } from '../types/interval';
import type { Session } from '~/types/session';
import type { Lap } from '~/types/lap';
import { LapChart } from '~/components/lap-chart';
import { DriverRankings } from '~/components/driver-rankings';
import type { DriverInterval } from '~/types/driver-interval';
import { useSettings } from '~/components/settings';
import { logger } from '../utils/logger';

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

export default function Home() {
  const [drivers, setDrivers] = useState<DriverInterval[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [driversData, setDriversData] = useState<ApiDriver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedPenalty, setSelectedPenalty] = useState<number>(0); // Add state for penalty
  const [lapsData, setLapsData] = useState<Lap[]>([]);
  const [raceFinished, setRaceFinished] = useState<boolean>(false);
  const { delay } = useSettings(); // Use global delay from settings context
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Fetch all available sessions once at component mount
  useEffect(() => {
    const getAllSessions = async () => {
      logger.log("Fetching all sessions...");
      try {
        const fetchedSessions = await fetchSessions(undefined, 'Race');
        if (fetchedSessions && fetchedSessions.length > 0) {
          setSessions(fetchedSessions);
          // Default to the last session in the array
          const defaultSession = fetchedSessions[fetchedSessions.length - 1];
          setSession(defaultSession);
          logger.log("Default session selected:", defaultSession);
        } else {
          setError('No sessions found');
        }
      } catch (err) {
        setError('Failed to fetch sessions');
        logger.error(err);
      }
    };

    getAllSessions();
  }, []);

  // Fetch drivers when session is available
  useEffect(() => {
    if (!session) return;
    const getDrivers = async () => {
      logger.log("Fetching drivers...");
      if (!session) return;
      try {
        const drivers = await fetchDrivers(session.session_key);
        if (drivers && drivers.length > 0) {
          setDriversData(drivers);
          logger.log("Drivers fetched:", drivers);
        } else {
          setError('No drivers found for this session');
        }
      } catch (err) {
        setError('Failed to fetch drivers');
        logger.error(err);
      }
    };

    getDrivers();
  }, [session]);

  // Fetch intervals and laps data when session is available
  useEffect(() => {
    if (!session || driversData.length === 0) return;

    let intervalId: NodeJS.Timeout;
    let previousProcessedIntervals: ProcessedInterval[] = [];
    let isFinished = false;

    const fetchData = async () => {
      try {
        // Check if race is finished
        isFinished = new Date().toISOString() > session.date_end;

        let lapsData: Lap[] = [];
        let intervalsData: ProcessedInterval[] = [];

        if (!isFinished) {
          lapsData = await fetchLaps(session.session_key, undefined, undefined, undefined, delay);
          intervalsData = await fetchIntervals(session.session_key, undefined, false, delay);

          if (intervalsData.length === 0) {
            if (lapsData.length > 0) {
              isFinished = true;
            } else {
              setIsStarting(true);
            }
          } else {
            setIsStarting(false);
          }
        }

        setRaceFinished(isFinished)

        if (isFinished) {
          lapsData = await fetchLaps(session.session_key, undefined, undefined);
          intervalsData = await fetchIntervals(session.session_key, lapsData[lapsData.length - 30].date_start, true);
        }

        logger.log("Intervals data fetched:", intervalsData);
        logger.log("Laps data fetched:", lapsData);

        // Store laps data
        setLapsData(lapsData);

        // Process the interval data
        const processedIntervals = processIntervalData(intervalsData, previousProcessedIntervals);
        previousProcessedIntervals = processedIntervals;

        // Create a map of driver colors by driver number
        const driverColorMap = new Map<number, string>();
        driversData.forEach(driver => {
          driverColorMap.set(driver.driver_number, driver.team_colour);
        });

        // Map the intervals to our DriverInterval format
        const mappedDrivers = processedIntervals.map(interval => {
          const driver = driversData.find(d => d.driver_number === interval.driver_number);
          const isLapped = typeof interval.gap_to_leader === 'string' && interval.gap_to_leader.includes('L');
          let lapsDown = 0;

          if (isLapped && typeof interval.gap_to_leader === 'string') {
            // Regex to match "1L", "+1 LAP", or "1 L" formats
            const match = interval.gap_to_leader.match(/(?:\+|)(\d+)\s*(?:L|LAP)/);
            lapsDown = match ? parseInt(match[1]) : 0;
          }

          return {
            name: driver?.name_acronym || `D${interval.driver_number}`,
            color: `#${driverColorMap.get(interval.driver_number)}` || '#CCCCCC',
            gapToLeader: interval.isLeader ? null : (isLapped ? Number.MAX_VALUE : Number(interval.gap_to_leader)),
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
            const circuitName = session?.circuit_short_name || '';
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
          if (a.isLapped && b.isLapped) return a.lapsDown - b.lapsDown;
          return (a.gapToLeader as number) - (b.gapToLeader as number);
        });

        setDrivers(sortedDrivers);
        setLoading(false);
      } catch (err) {
        // Just log the error
        logger.error('Error fetching data:', err);
        if (loading) setLoading(false);
      }
    };

    // Fetch immediately
    fetchData();

    // Only set up interval if race isn't finished
    if (!isFinished) {
      intervalId = setInterval(fetchData, 4000);
    }

    // Clean up
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, driversData, selectedDriver, selectedPenalty, delay]); // Add delay to dependency array

  if (loading) {
    return <div className="w-full p-5 my-5 font-sans text-gray-700 dark:text-gray-300">Loading driver data...</div>;
  }

  if (error) {
    return <div className="w-full p-5 my-5 font-sans text-red-500 dark:text-red-400">Error: {error}</div>;
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
            {drivers.length > 0 && (
              <DriverRankings
                drivers={drivers}
                session={session}
                raceFinished={raceFinished}
                lapsData={lapsData}
              />
            )}
          </div>

          {/* Right column - Selectors, Timeline, and Charts */}
          <div className="lg:w-4/5">
            {/* Driver timeline */}
            {drivers.length > 0 && (
              <div className='px-6 h-[35vh] pt-2'>
                {/* Driver and Penalty selectors */}
                <div className="bg-transparent flex flex-row items-center justify-center ml-2 space-x-2">
                  <select
                    className="border text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 pr-5 bg-white dark:bg-gray-800 focus:outline-none text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-md"
                    value={selectedDriver || ""}
                    onChange={(e) => setSelectedDriver(e.target.value || null)}
                  >
                    <option value="">Pit driver</option>
                    {drivers
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
                <DriverTimeline drivers={drivers} />
              </div>
            )}

            {/* Lap Chart */}
            {lapsData.length > 0 && (
              <div className="ml-2 h-[65vh]">
                <LapChart laps={lapsData} drivers={driversData} />
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
