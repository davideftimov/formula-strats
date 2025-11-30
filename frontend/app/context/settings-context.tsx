import React, { useState, useEffect, createContext, useContext } from "react";

interface SettingsContextType {
	delay: number;
	setDelay: React.Dispatch<React.SetStateAction<number>>;
	theme: "light" | "dark";
	toggleTheme: () => void;
	circuitAvgPitTimeLost: { green_flag: number; sc_vsc: number };
	setCircuitAvgPitTimeLost: React.Dispatch<React.SetStateAction<{ green_flag: number; sc_vsc: number; }>>;
}

export const SettingsContext = createContext<SettingsContextType>({
	delay: 0,
	setDelay: () => { },
	theme: "light",
	toggleTheme: () => { },
	circuitAvgPitTimeLost: { green_flag: 0, sc_vsc: 0 },
	setCircuitAvgPitTimeLost: () => { },
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [delay, setDelay] = useState<number>(0);
	const [theme, setTheme] = useState<"light" | "dark">("light");
	const [circuitAvgPitTimeLost, setCircuitAvgPitTimeLost] = useState<{ green_flag: number; sc_vsc: number }>({ green_flag: 0, sc_vsc: 0 });

	useEffect(() => {
		const savedDelay = localStorage.getItem("delay");
		if (savedDelay) {
			setDelay(Number(savedDelay));
		}

		const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)"
		).matches;
		const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
		setTheme(initialTheme);
	}, []);

	useEffect(() => {
		localStorage.setItem("delay", delay.toString());
	}, [delay]);

	useEffect(() => {
		if (theme === "dark") {
			document.documentElement.classList.add("dark");
			localStorage.setItem("theme", "dark");
		} else {
			document.documentElement.classList.remove("dark");
			localStorage.setItem("theme", "light");
		}
	}, [theme]);

	const toggleTheme = () => {
		setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
	};

	return (
		<SettingsContext.Provider value={{ delay, setDelay, theme, toggleTheme, circuitAvgPitTimeLost, setCircuitAvgPitTimeLost }}>
			{children}
		</SettingsContext.Provider>
	);
};
