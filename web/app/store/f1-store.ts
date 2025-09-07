import { Store } from '@tanstack/store'
import type { SessionInfo, DriverData, LapCount, TimingData, Lap, WeatherData } from '~/types/index';

interface F1State {
    sessionInfo: SessionInfo | null;
    driverData: DriverData;
    lapCount: LapCount | null;
    timingData: TimingData | null;
    lapData: Lap[];
    weatherData: WeatherData | null;
}

export const f1Store = new Store<F1State>({
    sessionInfo: null,
    driverData: {},
    lapCount: null,
    timingData: null,
    lapData: [],
    weatherData: null,
});
