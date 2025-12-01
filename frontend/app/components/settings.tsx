import React, { useState, useEffect } from "react";
import { NumberInput } from "./number-input";
import { useStore } from '@tanstack/react-store';
import { f1Store } from '~/store/f1-store';
import { useSettings } from "~/context/settings-context";
import { circuitAvgPitTimeLostData } from "~/data/circuit-data";

export const Settings: React.FC = () => {
	const [isOpen, setIsOpen] = useState(false);
	const { delay, setDelay, theme, toggleTheme, circuitAvgPitTimeLost, setCircuitAvgPitTimeLost } = useSettings();
	const [inputValues, setInputValues] = useState({
		delay: delay.toString(),
		greenFlag: circuitAvgPitTimeLost.green_flag.toString(),
		scVsc: circuitAvgPitTimeLost.sc_vsc.toString(),
	});

	const { session } = useStore(f1Store, (state) => ({
		session: state.sessionInfo,
	}));

	useEffect(() => {
		if (session) {
			const circuitName = session.Meeting.Circuit.ShortName || '';
			const pitTimeData = circuitAvgPitTimeLostData.find(c => c.circuit_short_name === circuitName);
			if (pitTimeData) {
				const newPitTimes = { green_flag: pitTimeData.green_flag, sc_vsc: pitTimeData.sc_vsc };
				setCircuitAvgPitTimeLost(newPitTimes);
				setInputValues(prev => ({
					...prev,
					greenFlag: newPitTimes.green_flag.toString(),
					scVsc: newPitTimes.sc_vsc.toString()
				}));
			} else {
				// fallback to default
				const defaultPitTimes = { green_flag: 20, sc_vsc: 12 };
				setCircuitAvgPitTimeLost(defaultPitTimes);
				setInputValues(prev => ({
					...prev,
					greenFlag: defaultPitTimes.green_flag.toString(),
					scVsc: defaultPitTimes.sc_vsc.toString()
				}));
			}
		}
	}, [session, setCircuitAvgPitTimeLost]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest(".settings-container") && !target.closest(".settings-button")) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	useEffect(() => {
		if (!isOpen) {
			setInputValues({
				delay: delay.toString(),
				greenFlag: circuitAvgPitTimeLost.green_flag.toString(),
				scVsc: circuitAvgPitTimeLost.sc_vsc.toString(),
			});
		}
	}, [isOpen, delay, circuitAvgPitTimeLost]);

	const handleNumericChange = (field: 'delay' | 'greenFlag' | 'scVsc', isFloat: boolean) => (e: React.ChangeEvent<HTMLInputElement>) => {
		const { value } = e.target;
		const regex = isFloat ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;

		if (regex.test(value)) {
			setInputValues(prev => ({ ...prev, [field]: value }));
			const numValue = isFloat ? parseFloat(value) : parseInt(value, 10);
			const valOrDefault = isNaN(numValue) ? 0 : numValue;

			if (field === 'delay') {
				setDelay(valOrDefault);
			} else if (field === 'greenFlag') {
				setCircuitAvgPitTimeLost(prev => ({ ...prev, green_flag: valOrDefault }));
			} else {
				setCircuitAvgPitTimeLost(prev => ({ ...prev, sc_vsc: valOrDefault }));
			}
		}
	};

	const handleBlur = (field: 'delay' | 'greenFlag' | 'scVsc') => () => {
		if (field === 'delay') {
			setInputValues(prev => ({ ...prev, delay: delay.toString() }));
		} else if (field === 'greenFlag') {
			setInputValues(prev => ({ ...prev, greenFlag: circuitAvgPitTimeLost.green_flag.toString() }));
		} else {
			setInputValues(prev => ({ ...prev, scVsc: circuitAvgPitTimeLost.sc_vsc.toString() }));
		}
	};

	return (
		<div className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="settings-button text-zinc-800 dark:text-zinc-200 hover:text-orange-500 transition-colors duration-200 cursor-pointer p-1"
				aria-label="Settings"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
					<path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 0 1 .804.98v1.361a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.294 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.294A1 1 0 0 1 1 10.68V9.32a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.38 3.03l1.25.834a6.957 6.957 0 0 1 1.416-.587l.294-1.473ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
				</svg>
			</button>

			{isOpen && (
				<div className="settings-container absolute right-0 mt-2 mr-2 w-64 bg-white dark:bg-black shadow-lg p-4 z-50 border border-zinc-200 dark:border-zinc-700">
					<h3 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-6">Settings</h3>
					<div className="space-y-4">
						<div className="">
							<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Theme
							</label>
							<button
								onClick={toggleTheme}
								className="flex items-center justify-between w-full p-2 cursor-pointer
								bg-gradient-to-b from-zinc-100 to-zinc-400 hover:from-zinc-300 to hover:to-zinc-300 hover:bg-zinc-300 
								focus:outline-none text-zinc-800 dark:text-black
								dark:inset-shadow-sm dark:inset-shadow-black 
								shadow-md shadow-zinc-400/50 dark:shadow-zinc-500/50"
							>
								<span className="text-sm">
									{theme === "light" ? "Turn off the lights" : "Turn on the lights"}
								</span>
							</button>
						</div>
						<NumberInput
							id="greenFlagPitTime"
							label="Green flag pit time loss (s)"
							pattern="[0-9]*\.?[0-9]*"
							value={inputValues.greenFlag}
							onChange={handleNumericChange('greenFlag', true)}
							onBlur={handleBlur('greenFlag')}
						/>
						<NumberInput
							id="scVscPitTime"
							label="SC/VSC pit time loss (s)"
							pattern="[0-9]*\.?[0-9]*"
							value={inputValues.scVsc}
							onChange={handleNumericChange('scVsc', true)}
							onBlur={handleBlur('scVsc')}
						/>
						<NumberInput
							id="delayInput"
							label="Delay (s)"
							pattern="[0-9]*"
							value={inputValues.delay}
							onChange={handleNumericChange('delay', false)}
							onBlur={handleBlur('delay')}
							description="Add delay to simulate race broadcast delay"
						/>
					</div>
				</div>
			)}
		</div>
	);
};