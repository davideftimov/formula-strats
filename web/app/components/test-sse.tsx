import React, { useState, useCallback } from 'react';
import useSSE from '~/hooks/useSSE';
import type { SessionInfo, DriverData, TimingData } from '~/types/f1-driver.types';

export const TestSseComponent: React.FC = () => {
	const [session, setSession] = useState<SessionInfo | null>(null);
	const [driverData, setDriverData] = useState<DriverData | null>(null);
	const [timingData, setTimingData] = useState<TimingData | null>(null);

	// Replace with your actual SSE endpoint URL
	const sseUrl = 'http://localhost:8000/f1-stream-sqlmodel/'; // Example URL, ensure this endpoint exists and works

	const handleSessionInfo = useCallback((data: SessionInfo | null) => {
		console.log('Received Session Info:', data);
		setSession(data);
	}, []);

	const handleDriverData = useCallback((data: DriverData | null) => {
		console.log('Received Driver Data:', data);
		if (data === null) {
			setDriverData(null);
		} else {
			setDriverData(prevData => {
				const newData = { ...(prevData || {}) };
				for (const key in data) {
					newData[key] = {
						...(prevData?.[key] || {}),
						...data[key],
					};
				}
				return newData;
			});
		}
	}, []);

	const handleTimingData = useCallback((data: TimingData | null) => {
		console.log('Received Timing Data:', data);
		if (data === null) {
			setTimingData(null);
		} else {
			setTimingData(prevData => {
				const newTimingData = {
					...(prevData || {}),
					...data, // Spread top-level properties from new data
					Lines: {
						...(prevData?.Lines || {}),
					},
				};

				if (data.Lines) {
					for (const key in data.Lines) {
						newTimingData.Lines[key] = {
							...(prevData?.Lines?.[key] || {}),
							...data.Lines[key],
						};
					}
				}
				return newTimingData;
			});
		}
	}, []);

	const { error, isConnected } = useSSE({
		url: sseUrl,
		onSessionInfo: handleSessionInfo,
		onDriverData: handleDriverData,
		onTimingData: handleTimingData,
	});

	return (
		<div>
			<h1>SSE Test Component</h1>
			<p>
				Connection Status:
				{isConnected ? (
					<span style={{ color: 'green' }}> Connected</span>
				) : (
					<span style={{ color: 'red' }}> Disconnected</span>
				)}
			</p>
			{error && (
				<p style={{ color: 'red' }}>
					Error: {typeof error === 'string' ? error : 'An error occurred.'}
				</p>
			)}

			<div>
				<h2>Session:</h2>
				{session ? (
					<pre>{JSON.stringify(session, null, 2)}</pre>
				) : (
					<p>No session data received yet.</p>
				)}
			</div>

			<div>
				<h2>Driver Data:</h2>
				{driverData ? (
					<pre>{JSON.stringify(driverData, null, 2)}</pre>
				) : (
					<p>No driver data received yet.</p>
				)}
			</div>

			<div>
				<h2>Timing Data:</h2>
				{timingData ? (
					<pre>{JSON.stringify(timingData, null, 2)}</pre>
				) : (
					<p>No timing data received yet.</p>
				)}
			</div>
		</div>
	);
};
