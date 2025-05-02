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
  const [timestamp, setTimestamp] = useState<string>("2024-08-25T13:03:19+00:00");
  const currentTimestampRef = useRef<string>("2025-04-20T19:15:00+00:00");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [lapsData, setLapsData] = useState<Lap[]>([]);
  const [raceFinished, setRaceFinished] = useState<boolean>(false);

  // Fetch all available sessions once at component mount
  useEffect(() => {
    const getAllSessions = async () => {
      console.log("Fetching all sessions...");
      try {
        const fetchedSessions = await fetchSessions(undefined, 'Race');
        if (fetchedSessions && fetchedSessions.length > 0) {
          setSessions(fetchedSessions);
          // Default to the last session in the array
          const defaultSession = fetchedSessions[fetchedSessions.length - 1];
          setSession(defaultSession);
          console.log("Default session selected:", defaultSession);
        } else {
          setError('No sessions found');
        }
      } catch (err) {
        setError('Failed to fetch sessions');
        console.error(err);
      }
    };

    getAllSessions();
  }, []);

  // Fetch drivers when session is available
  useEffect(() => {
    if (!session) return;
    const getDrivers = async () => {
      console.log("Fetching drivers...");
      if (!session) return;
      try {
        const drivers = await fetchDrivers(session.session_key);
        if (drivers && drivers.length > 0) {
          setDriversData(drivers);
          console.log("Drivers fetched:", drivers);
        } else {
          setError('No drivers found for this session');
        }
      } catch (err) {
        setError('Failed to fetch drivers');
        console.error(err);
      }
    };

    getDrivers();
  }, [session]);

  // Fetch intervals and laps data when session is available
  useEffect(() => {
    if (!session || driversData.length === 0) return;

    let intervalId: NodeJS.Timeout;
    let previousProcessedIntervals: ProcessedInterval[] = [];

    const fetchData = async () => {
      try {
        // Check if race is finished
        const isFinished = new Date().toISOString() > session.date_end;
        setRaceFinished(isFinished)

        let lapsData;
        let intervalsData;

        if (isFinished) {
          // Fetch
          lapsData = await fetchLaps(session.session_key, undefined, undefined);
          intervalsData = await fetchIntervals(session.session_key, lapsData[lapsData.length - 30].date_start, true);
        } else {
          lapsData = await fetchLaps(session.session_key, undefined, undefined);
          intervalsData = await fetchIntervals(session.session_key);
        }

        console.log("Intervals data fetched:", intervalsData);
        console.log("Laps data fetched:", lapsData);

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

        console.log("mappedDrivers", mappedDrivers);
        console.log("selectedDriver", selectedDriver);

        // Add simulated position after pit stop for selected driver
        if (selectedDriver) {
          const driverToPit = mappedDrivers.find(d => d.name === selectedDriver);
          if (driverToPit) {
            // Get pit time lost for current circuit
            const circuitName = session?.circuit_short_name || '';
            const pitTimeLostData = circuitAvgPitTimeLost.find(c => c.circuit_short_name === circuitName);
            const pitTimeLost = pitTimeLostData ? pitTimeLostData.green_flag : 20; // Default to 20s if not found

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
          if (a.isLapped && b.isLapped) return b.lapsDown - a.lapsDown;
          return (a.gapToLeader as number) - (b.gapToLeader as number);
        });

        setDrivers(sortedDrivers);
        setLoading(false);
      } catch (err) {
        // Just log the error
        console.error('Error fetching data:', err);
        if (loading) setLoading(false);
      }
    };

    // Fetch immediately
    fetchData();

    // Only set up interval if race isn't finished
    if (currentTimestampRef.current <= session.date_end) {
      intervalId = setInterval(fetchData, 4000);
    }

    // Clean up
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, driversData, selectedDriver]);

  if (loading) {
    return <div className="w-full p-5 my-5 font-sans text-gray-700 dark:text-gray-300">Loading driver data...</div>;
  }

  if (error) {
    return <div className="w-full p-5 my-5 font-sans text-red-500 dark:text-red-400">Error: {error}</div>;
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
                {/* Driver selector */}
                <div className="bg-transparent flex flex-row items-center justify-center ml-2">
                  <select
                    className="border text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 pr-5 bg-white dark:bg-gray-800 focus:outline-none text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-md"
                    value={selectedDriver || ""}
                    onChange={(e) => setSelectedDriver(e.target.value || null)}
                  >
                    <option value="">Pit driver</option>
                    {drivers.map((driver, index) => (
                      <option key={index} value={driver.name}>
                        {driver.name}
                      </option>
                    ))}
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
