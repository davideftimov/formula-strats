import { useState, useEffect, useRef } from 'react';
import type { F1Message, SessionInfo, DriverData, TimingData, Lap, WeatherData, LapCount, TrackStatus, Heartbeat } from '~/types';
import { f1Store } from '~/store/f1-store';
import { merge } from 'lodash';
import { logger } from '~/utils/logger';

interface UseSSEProps {
	url: string;
}

const useSSE = ({ url }: UseSSEProps) => {
	const [error, setError] = useState<string | null>(null);
	const [isConnected, setIsConnected] = useState<boolean>(false);
	const disconnectTimer = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined' || !url) {
			return;
		}

		const eventSource = new EventSource(url);

		const resetDisconnectTimer = () => {
			if (disconnectTimer.current) {
				clearTimeout(disconnectTimer.current);
			}
			disconnectTimer.current = setTimeout(() => {
				logger.log('SSE inactivity timeout after 30 seconds. Closing connection.');
				eventSource.close();
			}, 30000); // 30 seconds inactivity timeout
		};

		// f1Store.setState(state => ({
		// 	...state,
		// 	sessionInfo: null,
		// 	driverData: {},
		// 	lapCount: null,
		// 	trackStatus: null,
		// 	timingData: null,
		// 	lapData: [],
		// 	weatherData: null,
		// }));
		setError(null);
		setIsConnected(false);

		eventSource.onopen = () => {
			logger.log(`SSE connection opened to ${url}`);
			setIsConnected(true);
			setError(null);
			resetDisconnectTimer();
		};

		eventSource.onmessage = (event) => {
			resetDisconnectTimer();
			try {
				const parsedMessage = JSON.parse(event.data) as F1Message;
				const messagePayload = parsedMessage.payload;

				if (parsedMessage.type === 'DriverList') {
					f1Store.setState(state => ({ ...state, driverData: merge({}, state.driverData, messagePayload as DriverData) }));
					logger.log('SSE LEVEL DRIVER DATA PARSED:', parsedMessage);
				} else if (parsedMessage.type === 'TimingData') {
					f1Store.setState(state => ({ ...state, timingData: merge({}, state.timingData, messagePayload as TimingData) }));
					logger.log('SSE LEVEL TIMING DATA PARSED:', parsedMessage);
				} else if (parsedMessage.type === 'LapCount') {
					f1Store.setState(state => ({ ...state, lapCount: merge({}, state.timingData, messagePayload as LapCount) }));
					logger.log('SSE LEVEL LAP COUNT PARSED:', parsedMessage);
				} else if (parsedMessage.type === 'TrackStatus') {
					f1Store.setState(state => ({ ...state, trackStatus: merge({}, state.timingData, messagePayload as TrackStatus) }));
					logger.log('SSE LEVEL TRACK STATUS PARSED:', parsedMessage);
				} else if (parsedMessage.type === 'SessionInfo') {
					f1Store.setState(state => ({ ...state, sessionInfo: messagePayload as SessionInfo }));
					logger.log('SSE LEVEL SESSION INFO PARSED:', parsedMessage);
				} else if (parsedMessage.type === 'LapData') {
					f1Store.setState(state => ({ ...state, lapData: [...state.lapData, ...(messagePayload as Lap[])] }));
					logger.log('SSE LEVEL LAP DATA PARSED:', parsedMessage);
				} else if (parsedMessage.type === 'WeatherData') {
					f1Store.setState(state => ({ ...state, weatherData: messagePayload as WeatherData }));
					logger.log('SSE LEVEL WEATHER DATA PARSED:', parsedMessage);
				} else if (parsedMessage.type === 'Heartbeat') {
					f1Store.setState(state => ({ ...state, heartbeat: messagePayload as Heartbeat }));
					logger.log('SSE LEVEL HEARTBEAT PARSED:', parsedMessage);
				} else {
					logger.warn(
						`Received SSE message with unhandled data structure. Type: ${parsedMessage.type}`,
						messagePayload
					);
				}
			} catch (e) {
				logger.error('Failed to parse SSE message data:', e, event.data);
				setError('Failed to parse message data.');
			}
		};

		eventSource.onerror = (errEvent) => {
			logger.error(`SSE connection error for ${url}:`, errEvent);
			// If readyState is EventSource.CLOSED, it means the connection was permanently closed or not opened.
			if (eventSource.readyState === EventSource.CLOSED) {
				setError('SSE connection closed by server or due to an irrecoverable error.');
			} else {
				setError('SSE connection error. Browser will attempt to reconnect.');
			}
			setIsConnected(false);
		};

		return () => {
			logger.log(`Closing SSE connection to ${url}`);
			if (disconnectTimer.current) {
				clearTimeout(disconnectTimer.current);
			}
			eventSource.close();
			setIsConnected(false);
		};
	}, [url]);

	return { error, isConnected };
};

export default useSSE;
