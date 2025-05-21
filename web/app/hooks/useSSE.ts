import { useState, useEffect } from 'react';
import type { Session } from 'react-router';
import type { F1Message, SessionInfo, DriverData, TimingData, Lap } from '~/types/index';

// Type guard for TimingData
// Assumes TimingData has 'Lines' and 'Withheld' properties.
function isTimingData(data: any): data is TimingData {
	return data && typeof data === 'object' && 'Lines' in data && 'Withheld' in data;
}

// Type guard for DriverData
// Assumes DriverData is an object of DriverDetails, and not TimingData.
// It also checks for common properties of DriverDetails in the first entry if the object is not empty.
function isDriverData(data: any): data is DriverData {
	if (data && typeof data === 'object' && !isTimingData(data)) {
		// An empty object could be valid initial DriverData.
		const keys = Object.keys(data);
		if (keys.length === 0) return true;

		// If not empty, check the structure of the first item, expecting DriverDetails.
		const firstValue = data[keys[0]];
		return (
			firstValue &&
			typeof firstValue === 'object' &&
			'RacingNumber' in firstValue &&
			'FullName' in firstValue
		);
	}
	return false;
}

interface UseSSEProps {
	url: string;
	onSessionInfo: (data: SessionInfo | null) => void;
	onDriverData: (data: DriverData | null) => void;
	onTimingData: (data: TimingData | null) => void;
	onLapData: (data: Lap[] | null) => void;
}

const useSSE = ({ url, onSessionInfo, onDriverData, onTimingData, onLapData }: UseSSEProps) => {
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
