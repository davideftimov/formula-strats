import type { Route } from "./+types/home";
import { DriverTimeline } from "~/components/driver-timeline";
import { Footer } from "~/components/footer";
import React, { useState, useMemo } from 'react';
import { LapChart } from '~/components/lap-chart';
import { DriverRankings } from '~/components/driver-rankings';
import type { DriverInterval } from '~/types/driver-interval';
import { useSettings } from '~/components/settings';
import { logger } from '../utils/logger';
import useSSE from '~/hooks/useSSE';
import { Nav } from '~/components/nav';
import { useStore } from '@tanstack/react-store';
import { f1Store } from '~/store/f1-store';

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
  const { sessionInfo, driverData, lapCount, trackStatus, timingData, lapData, weatherData } = useStore(f1Store);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedPenalty, setSelectedPenalty] = useState<number>(0); // Add state for penalty
  const { delay } = useSettings(); // Use global delay from settings context
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const sseUrl = import.meta.env.VITE_SSE_URL;

  const { error, isConnected } = useSSE({
    url: sseUrl,
  });

  const loading = !sessionInfo || !driverData || !timingData;

  const mappedDrivers = useMemo(() => {
    if (!sessionInfo || !driverData || !timingData || !timingData.Lines) {
      return [];
    }

    const driverKeys = Object.keys(timingData.Lines);
    if (driverKeys.length === 0) {
      return [];
    }

    let currentDrivers: DriverInterval[] = driverKeys.map(racingNumber => {
      const driverTimingInfo = timingData.Lines[racingNumber];
      const driverDetails = driverData[racingNumber];

      if (!driverDetails) {
        logger.warn(`Driver details not found for racing number: ${racingNumber}`);
        // TO DO
      }

      let name = driverDetails.Tla;
      const isRetired = driverTimingInfo.Retired;
      const isStopped = driverTimingInfo.Stopped;
      const isSpecialStatus = isRetired || isStopped;

      let gapDisplay: string;
      let gapInSeconds: number = -1;

      if (driverTimingInfo.Position === "1") {
        gapDisplay = "Leader";
        gapInSeconds = 0;
      } else if (driverTimingInfo.GapToLeader) {
        gapDisplay = driverTimingInfo.GapToLeader;
        if (driverTimingInfo.GapToLeader.includes('L')) {
          // isLapped = true; // Value assigned but not used
          gapInSeconds = Infinity;
        } else {
          try {
            gapInSeconds = parseTimeToSeconds(driverTimingInfo.GapToLeader);
          } catch (e) {
            logger.warn(`Could not parse GapToLeader for driver ${racingNumber}: ${driverTimingInfo.GapToLeader}`, e);
            gapInSeconds = Infinity;
          }
        }
      } else {
        if (lapCount && (driverTimingInfo.Retired || driverTimingInfo.Stopped)) {
          if (driverTimingInfo.NumberOfLaps) {
            gapDisplay = `${lapCount.CurrentLap - driverTimingInfo.NumberOfLaps}L`
          } else {
            gapDisplay = `${lapCount.CurrentLap}L`
          }
        } else {
          gapDisplay = "-";
        }
        gapInSeconds = Infinity;
        logger.warn(`GapToLeader is missing for driver ${racingNumber} (Position: ${driverTimingInfo.Position})`);
      }

      return {
        racingNumber: racingNumber,
        position: parseInt(driverTimingInfo.Position, 10),
        displayPosition: driverTimingInfo.Position,
        name: name,
        color: `#${driverDetails.TeamColour}`,
        gapDisplay: gapDisplay,
        gapInSeconds: gapInSeconds,
        isSpecialStatus: isSpecialStatus,
      };
    }).sort((a, b) => a.position - b.position);

    logger.log("mappedDrivers before pit sim", [...currentDrivers]);
    logger.log("selectedDriver for pit sim", selectedDriver);

    if (selectedDriver) {
      const driverToPit = currentDrivers.find(d => d.name === selectedDriver);
      if (driverToPit) {
        const circuitName = sessionInfo.Meeting.Circuit.ShortName || '';
        const pitTimeLostData = circuitAvgPitTimeLost.find(c => c.circuit_short_name === circuitName);
        const pitTimeLost = (pitTimeLostData
          ? (trackStatus?.Status === "6" || trackStatus?.Status === "4"
            ? pitTimeLostData.sc_vsc
            : pitTimeLostData.green_flag)
          : 20
        ) + selectedPenalty;
        const gapInSecondsAfterPit = driverToPit.gapInSeconds + pitTimeLost;

        const simulatedDriver = {
          ...driverToPit,
          name: `${driverToPit.name} (Pit)`,
          color: driverToPit.color + '80',
          gapInSeconds: gapInSecondsAfterPit,
          gapDisplay: `+${gapInSecondsAfterPit.toFixed(1)}s`,
          isSpecialStatus: true,
        };
        currentDrivers.push(simulatedDriver);
        currentDrivers.sort((a, b) => a.gapInSeconds - b.gapInSeconds);
      }
    }

    logger.log("Final computed drivers in useMemo", currentDrivers);
    return currentDrivers;
  }, [sessionInfo, timingData, driverData, selectedDriver, selectedPenalty]);


  function handleDriverChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedDriver(event.target.value || null)
  }

  function handlePenaltyChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedPenalty(Number(event.target.value));
  }

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
        <div className="h-[4vh]">
          {sessionInfo && (
            <Nav
              session={sessionInfo}
              lapCount={lapCount}
              weatherData={weatherData}
              trackStatus={trackStatus}
              selectedPenalty={selectedPenalty}
              handlePenaltyChange={handlePenaltyChange}
              selectedDriver={selectedDriver}
              handleDriverChange={handleDriverChange}
              drivers={mappedDrivers}
            />
          )}
        </div>
        {/* Two-column layout container */}
        <div className="lg:flex"> {/* h-full */}
          {/* Left column - Driver Rankings */}
          <div className="lg:w-1/5 flex flex-col h-full justify-start border-r border-gray-200 dark:border-gray-700">
            {mappedDrivers.length > 0 && (
              <DriverRankings
                drivers={mappedDrivers}
              />
            )}
          </div>

          {/* Right column - Selectors, Timeline, and Charts */}
          <div className="lg:w-4/5">
            {/* Driver timeline */}
            {mappedDrivers.length > 0 && (
              <div className='px-6 h-[25vh] pt-2'>
                <DriverTimeline drivers={mappedDrivers} />
              </div>
            )}

            {/* Lap Chart */}
            {lapData.length > 0 && (
              <div className="ml-2 h-[71vh]">
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
