import { useState, useEffect } from 'react';
import type { F1Message, SessionInfo, DriverData, TimingData, Lap, WeatherData } from '~/types/index';

interface UseSSEProps {
	url: string;
	onSessionInfo: (data: SessionInfo | null) => void;
	onDriverData: (data: DriverData | null) => void;
	onTimingData: (data: TimingData | null) => void;
	onLapData: (data: Lap[] | null) => void;
	onWeatherData: (data: WeatherData | null) => void;
}

const useSSE = ({ url, onSessionInfo, onDriverData, onTimingData, onLapData, onWeatherData }: UseSSEProps) => {
	const [error, setError] = useState<Event | string | null>(null);
	const [isConnected, setIsConnected] = useState<boolean>(false);

	useEffect(() => {
		// EventSource is a browser-only API. Do not run in SSR environments.
		if (typeof window === 'undefined' || !url) {
			return;
		}

		const eventSource = new EventSource(url);
		// Clear previous data by calling callbacks with null
		onSessionInfo(null)
		onDriverData(null);
		onTimingData(null);
		onLapData(null);
		onWeatherData(null);
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
					onDriverData(messagePayload as DriverData);
					console.log('SSE LEVEL DRIVER DATA PARSED:', parsedMessage);
					console.log('SSE LEVEL DRIVER DATA:', messagePayload);
				} else if (parsedMessage.type === 'TimingData') {
					onTimingData(messagePayload as TimingData);
					console.log('SSE LEVEL TIMING DATA PARSED:', parsedMessage);
					console.log('SSE LEVEL TIMING DATA:', messagePayload);
				} else if (parsedMessage.type === 'SessionInfo') {
					onSessionInfo(messagePayload as SessionInfo);
					console.log('SSE LEVEL SESSION INFO PARSED:', parsedMessage);
					console.log('SSE LEVEL SESSION INFO:', messagePayload);
				} else if (parsedMessage.type === 'SessionInfo') {
					onSessionInfo(messagePayload as SessionInfo);
					console.log('SSE LEVEL SESSION INFO PARSED:', parsedMessage);
					console.log('SSE LEVEL SESSION INFO:', messagePayload);
				} else if (parsedMessage.type === 'LapData') {
					onLapData(messagePayload as Lap[]);
					console.log('SSE LEVEL LAP DATA PARSED:', parsedMessage);
					console.log('SSE LEVEL LAP DATA:', messagePayload);
				} else if (parsedMessage.type === 'WeatherData') {
					onWeatherData(messagePayload as WeatherData);
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
	}, [url, onDriverData, onTimingData]); // Re-establish connection if URL or callbacks change

	return { error, isConnected };
};

export default useSSE;
