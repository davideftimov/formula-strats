import { Store } from '@tanstack/store'
import type { SessionInfo, DriverData, LapCount, TrackStatus, TimingData, Lap, WeatherData, Heartbeat, RaceControlMessages, WeatherDataSeries, TyreStintSeries } from '~/types';

interface F1State {
    sessionInfo: SessionInfo | null;
    driverData: DriverData;
    lapCount: LapCount | null;
    trackStatus?: TrackStatus | null;
    timingData: TimingData | null;
    lapData: Lap[];
    weatherData: WeatherData | null;
    heartbeat: Heartbeat | null;
    raceControlMessages: RaceControlMessages | null;
    weatherDataSeries: WeatherDataSeries | null;
    tyreStintSeries: TyreStintSeries | null;
}

export const f1Store = new Store<F1State>({
    sessionInfo: null,
    driverData: {},
    lapCount: null,
    trackStatus: null,
    timingData: null,
    lapData: [],
    weatherData: null,
    heartbeat: null,
    raceControlMessages: null,
    weatherDataSeries: null,
    tyreStintSeries: null,
});
