import { Store } from '@tanstack/store'
import type { SessionInfo, DriverData, TimingData, Lap, WeatherData } from '~/types/index';

interface F1State {
    sessionInfo: SessionInfo | null;
    driverData: DriverData;
    timingData: TimingData | null;
    lapData: Lap[];
    weatherData: WeatherData | null;
}

export const f1Store = new Store<F1State>({
    sessionInfo: null,
    driverData: {},
    timingData: null,
    lapData: [],
    weatherData: null,
});
