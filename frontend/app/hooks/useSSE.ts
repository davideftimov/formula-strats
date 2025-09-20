import { useState, useEffect, useRef } from 'react';
import type { F1Message, SessionInfo, DriverData, TimingData, Lap, WeatherData, LapCount, TrackStatus, Heartbeat, RaceControlMessages, WeatherDataSeries } from '~/types';
import { f1Store } from '~/store/f1-store';
import { merge } from 'lodash';
import { logger } from '~/utils/logger';

const processF1Message = (message: F1Message) => {
	const messagePayload = message.payload;

	if (message.type === 'DriverList') {
		f1Store.setState(state => ({ ...state, driverData: merge({}, state.driverData, messagePayload as DriverData) }));
		logger.log('SSE LEVEL DRIVER DATA PARSED:', message);
	} else if (message.type === 'TimingData') {
		f1Store.setState(state => ({ ...state, timingData: merge({}, state.timingData, messagePayload as TimingData) }));
		logger.log('SSE LEVEL TIMING DATA PARSED:', message);
	} else if (message.type === 'LapCount') {
		f1Store.setState(state => ({ ...state, lapCount: merge({}, state.timingData, messagePayload as LapCount) }));
		logger.log('SSE LEVEL LAP COUNT PARSED:', message);
	} else if (message.type === 'TrackStatus') {
		f1Store.setState(state => ({ ...state, trackStatus: merge({}, state.timingData, messagePayload as TrackStatus) }));
		logger.log('SSE LEVEL TRACK STATUS PARSED:', message);
	} else if (message.type === 'SessionInfo') {
		f1Store.setState(state => ({ ...state, sessionInfo: messagePayload as SessionInfo }));
		logger.log('SSE LEVEL SESSION INFO PARSED:', message);
	} else if (message.type === 'LapData') {
		f1Store.setState(state => ({ ...state, lapData: [...state.lapData, ...(messagePayload as Lap[])] }));
		logger.log('SSE LEVEL LAP DATA PARSED:', message);
	} else if (message.type === 'WeatherData') {
		f1Store.setState(state => ({ ...state, weatherData: messagePayload as WeatherData }));
		logger.log('SSE LEVEL WEATHER DATA PARSED:', message);
	} else if (message.type === 'Heartbeat') {
		f1Store.setState(state => ({ ...state, heartbeat: messagePayload as Heartbeat }));
		logger.log('SSE LEVEL HEARTBEAT PARSED:', message);
	} else if (message.type === 'RaceControlMessages') {
		f1Store.setState(state => ({ ...state, raceControlMessages: messagePayload as RaceControlMessages }));
		logger.log('SSE LEVEL RACE CONTROL MESSAGES PARSED:', message);
	} else if (message.type === 'WeatherDataSeries') {
		f1Store.setState(state => ({ ...state, weatherDataSeries: messagePayload as WeatherDataSeries }));
		logger.log('SSE LEVEL WEATHER DATA SERIES PARSED:', message);
	} else {
		logger.warn(
			`Received SSE message with unhandled data structure. Type: ${message.type}`,
			messagePayload
		);
	}
};

interface UseSSEProps {
	url: string;
	delay: number;
}

const useSSE = ({ url, delay }: UseSSEProps) => {
	const [error, setError] = useState<string | null>(null);
	const [isConnected, setIsConnected] = useState<boolean>(false);
	const disconnectTimer = useRef<NodeJS.Timeout | null>(null);

	const delayRef = useRef(delay);
	const queueRef = useRef<{
		messages: Array<{ message: F1Message, receivedAt: number }>;
		timerId: NodeJS.Timeout | null;
	}>({ messages: [], timerId: null });

	const scheduleProcessing = () => {
		if (queueRef.current.timerId || queueRef.current.messages.length === 0) {
			return;
		}

		const nextMessage = queueRef.current.messages[0];
		const delayInMs = delayRef.current * 1000;
		const timeToWait = (nextMessage.receivedAt + delayInMs) - Date.now();

		queueRef.current.timerId = setTimeout(processQueue, Math.max(0, timeToWait));
	};

	const processQueue = () => {
		const now = Date.now();
		const delayInMs = delayRef.current * 1000;
		let processCount = 0;

		for (const item of queueRef.current.messages) {
			if (now >= item.receivedAt + delayInMs) {
				processF1Message(item.message);
				processCount++;
			} else {
				break;
			}
		}

		if (processCount > 0) {
			queueRef.current.messages.splice(0, processCount);
		}

		queueRef.current.timerId = null;
		scheduleProcessing();
	};

	useEffect(() => {
		delayRef.current = delay;
		if (queueRef.current.timerId) {
			clearTimeout(queueRef.current.timerId);
			queueRef.current.timerId = null;
		}
		if (delay === 0) {
			if (queueRef.current.messages.length > 0) {
				queueRef.current.messages.forEach(item => processF1Message(item.message));
				queueRef.current.messages = [];
			}
		} else {
			scheduleProcessing();
		}
	}, [delay]);

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
			}, 30000);
		};

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
				if (delayRef.current === 0) {
					processF1Message(parsedMessage);
				} else {
					queueRef.current.messages.push({ message: parsedMessage, receivedAt: Date.now() });
					scheduleProcessing();
				}
			} catch (e) {
				logger.error('Failed to parse SSE message data:', e, event.data);
				setError('Failed to parse message data.');
			}
		};

		eventSource.onerror = (errEvent) => {
			logger.error(`SSE connection error for ${url}:`, errEvent);
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
			if (queueRef.current.timerId) {
				clearTimeout(queueRef.current.timerId);
			}
			eventSource.close();
			setIsConnected(false);
		};
	}, [url]);

	return { error, isConnected };
};

export default useSSE;