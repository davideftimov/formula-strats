import type { Route } from "./+types/home";
import { Timeline } from "~/components/timeline";
import { Footer } from "~/components/footer";
import React, { useState, useMemo, useEffect } from 'react';
import { LapChart } from '~/components/lap-chart';
import { Rankings } from '~/components/rankings';
import type { DriverInterval } from '~/types';
import { useSettings } from "~/context/settings-context";
import { logger } from '../utils/logger';
import useSSE from '~/hooks/useSSE';
import { Nav } from '~/components/nav';
import { useStore } from '@tanstack/react-store';
import { f1Store } from '~/store/f1-store';
import { RaceControlMessages } from '~/components/race-control-messages';
import { WeatherCharts } from '~/components/weather-charts';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Formula Strats" },
    { name: "description", content: "The favorite app of all formula armchair strategists." },
  ];
}

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
  const { sessionInfo, driverData, lapCount, trackStatus, timingData, tyreStintSeries } = useStore(f1Store, (state) => ({
    sessionInfo: state.sessionInfo,
    driverData: state.driverData,
    lapCount: state.lapCount,
    trackStatus: state.trackStatus,
    timingData: state.timingData,
    tyreStintSeries: state.tyreStintSeries,
  }));
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedPenalty, setSelectedPenalty] = useState<number>(0);
  const { delay, circuitAvgPitTimeLost } = useSettings();

  const sseUrl = import.meta.env.VITE_SSE_URL;

  const { error, isConnected } = useSSE({
    url: sseUrl,
    delay,
  });

  const loading = !sessionInfo || !driverData;

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
      const driverStints = tyreStintSeries?.Stints[racingNumber];

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
        intervalToPositionAhead: driverTimingInfo.IntervalToPositionAhead?.Value || '',
        gapInSeconds: gapInSeconds,
        isSpecialStatus: isSpecialStatus,
        stints: driverStints,
      };
    }).sort((a, b) => a.position - b.position);

    logger.log("mappedDrivers before pit sim", [...currentDrivers]);
    logger.log("selectedDriver for pit sim", selectedDriver);

    if (selectedDriver) {
      const driverToPit = currentDrivers.find(d => d.name === selectedDriver);
      if (driverToPit) {
        const pitTimeLost = (trackStatus?.Status === "6" || trackStatus?.Status === "4"
          ? circuitAvgPitTimeLost.sc_vsc
          : circuitAvgPitTimeLost.green_flag
        ) + selectedPenalty;
        const gapInSecondsAfterPit = driverToPit.gapInSeconds + pitTimeLost;

        const simulatedDriver: DriverInterval = {
          ...driverToPit,
          racingNumber: `${driverToPit.racingNumber}-pit`,
          name: `${driverToPit.name} (Pit)`,
          color: driverToPit.color + '80',
          gapInSeconds: gapInSecondsAfterPit,
          gapDisplay: `+${gapInSecondsAfterPit.toFixed(1)}s`,
          isSpecialStatus: true,
          intervalToPositionAhead: '',
        };
        currentDrivers.push(simulatedDriver);
        currentDrivers.sort((a, b) => a.gapInSeconds - b.gapInSeconds);

        const simulatedDriverIndex = currentDrivers.findIndex(d => d.name === simulatedDriver.name);
        if (simulatedDriverIndex > 0) {
          const driverAhead = currentDrivers[simulatedDriverIndex - 1];
          const interval = currentDrivers[simulatedDriverIndex].gapInSeconds - driverAhead.gapInSeconds;
          if (interval >= 0 && isFinite(interval)) {
            currentDrivers[simulatedDriverIndex].intervalToPositionAhead = `+${interval.toFixed(1)}`;
          }
        }
      }
    }

    logger.log("Final computed drivers in useMemo", currentDrivers);
    return currentDrivers;
  }, [sessionInfo, timingData, driverData, selectedDriver, selectedPenalty, tyreStintSeries, circuitAvgPitTimeLost, trackStatus]);


  function handleDriverChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedDriver(event.target.value || null)
  }

  function handlePenaltyChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedPenalty(Number(event.target.value));
  }

  if (loading) {
    return (
      <div className="w-full p-5 my-5 font-sans text-zinc-700 dark:text-zinc-300 flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mb-4"></div>
        <div className="text-xl text-center">
          <p>Warming up the engines...</p>
          {delay > 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              The loading will take longer due to the configured delay of {delay} seconds.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full lg:h-[100vh] font-sans">
        <div className="lg:h-[4vh]">
          {sessionInfo && (
            <Nav
              selectedPenalty={selectedPenalty}
              handlePenaltyChange={handlePenaltyChange}
              selectedDriver={selectedDriver}
              handleDriverChange={handleDriverChange}
              drivers={mappedDrivers}
            />
          )}
        </div>
        {/* Two-column layout container */}
        <div className="lg:flex lg:h-[96vh]">
          {/* Left column - Driver Rankings and Race Control */}
          <div className="lg:w-[22%] flex flex-col">
            <div className="overflow-y-auto lg:basis-3/4 border-x border-t lg:border-t-0 border-b border-zinc-200 dark:border-zinc-700">
              <Rankings
                drivers={mappedDrivers}
              />
            </div>
            <div className="h-[25vh] overflow-y-auto lg:basis-1/4 lg:h-auto border-x border-b border-zinc-200 dark:border-zinc-700">
              <RaceControlMessages />
            </div>
          </div>

          {/* Right column - Timeline, and Charts */}
          <div className="lg:w-[78%] lg:flex lg:flex-col">
            {/* Driver timeline */}
            <div className="h-[25vh] px-6 pt-2 overflow-y-auto lg:basis-1/4 lg:h-auto">
              <Timeline drivers={mappedDrivers} />
            </div>

            {/* Charts */}
            <div className="lg:basis-3/4 lg:h-auto flex flex-col lg:flex-row">
              <div className="h-[70vh] w-full lg:ml-2 lg:w-2/3 lg:h-auto">
                <LapChart />
              </div>
              <div className="h-[70vh] w-full lg:w-1/3 lg:h-auto">
                <WeatherCharts />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
