import { useState, useEffect } from 'react';
import type { F1Message, SessionInfo, DriverData, TimingData, Lap, WeatherData, LapCount } from '~/types/index';
import { f1Store } from '~/store/f1-store';
import { merge } from 'lodash';

interface UseSSEProps {
	url: string;
}

const useSSE = ({ url }: UseSSEProps) => {
	const [error, setError] = useState<Event | string | null>(null);
	const [isConnected, setIsConnected] = useState<boolean>(false);

	useEffect(() => {
		// EventSource is a browser-only API. Do not run in SSR environments.
		if (typeof window === 'undefined' || !url) {
			return;
		}

		const eventSource = new EventSource(url);
		// Clear previous data by resetting the store
		f1Store.setState(state => ({
			...state,
			sessionInfo: null,
			driverData: {},
			lapCount: null,
			timingData: null,
			lapData: [],
			weatherData: null,
		}));
		setError(null);
		setIsConnected(false); // Initially not connected

		eventSource.onopen = () => {
			console.log(`SSE connection opened to ${url}`);
			setIsConnected(true);
			setError(null);
		};

		eventSource.onmessage = (event) => {
			try {
				const parsedMessage = JSON.parse(event.data) as F1Message;
				const messagePayload = parsedMessage.payload;

				// Use type guards to determine the type of data and call the appropriate callback
				if (parsedMessage.type === 'DriverList') {
					f1Store.setState(state => ({ ...state, driverData: merge({}, state.driverData, messagePayload as DriverData) }));
					console.log('SSE LEVEL DRIVER DATA PARSED:', parsedMessage);
					console.log('SSE LEVEL DRIVER DATA:', messagePayload);
				} else if (parsedMessage.type === 'TimingData') {
					f1Store.setState(state => ({ ...state, timingData: merge({}, state.timingData, messagePayload as TimingData) }));
					console.log('SSE LEVEL TIMING DATA PARSED:', parsedMessage);
					console.log('SSE LEVEL TIMING DATA:', messagePayload);
				} else if (parsedMessage.type === 'LapCount') {
					f1Store.setState(state => ({ ...state, lapCount: merge({}, state.timingData, messagePayload as LapCount) }));
					console.log('SSE LEVEL LAP COUNT PARSED:', parsedMessage);
					console.log('SSE LEVEL LAP COUNT:', messagePayload);
				} else if (parsedMessage.type === 'SessionInfo') {
					f1Store.setState(state => ({ ...state, sessionInfo: messagePayload as SessionInfo }));
					console.log('SSE LEVEL SESSION INFO PARSED:', parsedMessage);
					console.log('SSE LEVEL SESSION INFO:', messagePayload);
				} else if (parsedMessage.type === 'LapData') {
					f1Store.setState(state => ({ ...state, lapData: [...state.lapData, ...(messagePayload as Lap[])] }));
					console.log('SSE LEVEL LAP DATA PARSED:', parsedMessage);
					console.log('SSE LEVEL LAP DATA:', messagePayload);
				} else if (parsedMessage.type === 'WeatherData') {
					f1Store.setState(state => ({ ...state, weatherData: messagePayload as WeatherData }));
					console.log('SSE LEVEL WEATHER DATA PARSED:', parsedMessage);
					console.log('SSE LEVEL WEATHER DATA:', messagePayload);
				} else {
					console.warn(
						`Received SSE message with unhandled data structure. Type: ${parsedMessage.type}`,
						messagePayload
					);
				}
			} catch (e) {
				console.error('Failed to parse SSE message data:', e, event.data);
				setError('Failed to parse message data.');
			}
		};

		eventSource.onerror = (errEvent) => {
			console.error(`SSE connection error for ${url}:`, errEvent);
			// The EventSource API attempts to reconnect automatically on most errors.
			// If readyState is EventSource.CLOSED, it means the connection was permanently closed or not opened.
			if (eventSource.readyState === EventSource.CLOSED) {
				setError('SSE connection closed by server or due to an irrecoverable error.');
			} else {
				setError('SSE connection error. Browser will attempt to reconnect.');
				// Browser handles reconnection. We reflect the disconnected state.
			}
			setIsConnected(false);
		};

		// Cleanup function: close the connection when the component unmounts or URL changes
		return () => {
			console.log(`Closing SSE connection to ${url}`);
			eventSource.close();
			setIsConnected(false);
		};
	}, [url]); // Re-establish connection if URL changes

	return { error, isConnected };
};

export default useSSE;
