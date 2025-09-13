import React, { useState, useEffect, createContext, useContext } from "react";

interface SettingsContextType {
	delay: number;
	setDelay: (delay: number) => void;
	theme: "light" | "dark";
	toggleTheme: () => void;
}

export const SettingsContext = createContext<SettingsContextType>({
	delay: 0,
	setDelay: () => { },
	theme: "light",
	toggleTheme: () => { },
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [delay, setDelay] = useState<number>(0);
	const [theme, setTheme] = useState<"light" | "dark">("light");

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
		<SettingsContext.Provider value={{ delay, setDelay, theme, toggleTheme }}>
			{children}
		</SettingsContext.Provider>
	);
};

export const Settings: React.FC = () => {
	const [isOpen, setIsOpen] = useState(false);
	const { delay, setDelay, theme, toggleTheme } = useSettings();
	const [inputValue, setInputValue] = useState<string>(delay.toString());

	// Sync context delay to local input value when delay changes externally
	useEffect(() => {
		setInputValue(delay.toString());
	}, [delay]);

	// Close the settings when clicking outside
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

	return (
		<div className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="settings-button text-zinc-800 dark:text-zinc-200 hover:text-orange-500 transition-colors duration-200 cursor-pointer p-1"
				aria-label="Settings"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fillRule="evenodd"
						d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
						clipRule="evenodd"
					/>
				</svg>
			</button>

			{isOpen && (
				<div className="settings-container absolute right-0 mt-2 mr-2 w-64 bg-white dark:bg-zinc-900 rounded-md shadow-lg p-4 z-50 border border-zinc-200 dark:border-zinc-700">
					<h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Settings</h3>

					<div className="mb-3">
						<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
							Theme
						</label>
						<button
							onClick={toggleTheme}
							className="flex items-center justify-between w-full p-2 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-600"
						>
							<span className="text-sm text-zinc-700 dark:text-zinc-300">
								{theme === "light" ? "Light Mode" : "Dark Mode"}
							</span>
							{theme === "light" ? (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 text-zinc-700"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 4.343a.75.75 0 011.06 1.06l-1.06 1.061a.75.75 0 01-1.06-1.06l1.06-1.06zM4.343 15.657a.75.75 0 011.06 1.06l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.061zM18 10a.75.75 0 01.75.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM15.657 15.657a.75.75 0 01-1.06 1.06l-1.061-1.06a.75.75 0 111.06-1.06l1.06 1.06zM4.343 4.343a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 011.06-1.06l1.06 1.06z" />
								</svg>
							) : (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 text-zinc-300"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
								</svg>
							)}
						</button>
					</div>

					<div>
						<label htmlFor="delayInput" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
							Delay (seconds)
						</label>
						<input
							id="delayInput"
							type="text"
							inputMode="numeric"
							pattern="[0-9]*"
							className="w-full border border-zinc-300 dark:border-zinc-600 rounded-md p-2 bg-white dark:bg-zinc-800 focus:outline-none text-zinc-700 dark:text-zinc-200"
							value={inputValue}
							onChange={(e) => {
								const value = e.target.value;
								// Allow only empty string or non-negative integers
								if (/^[0-9]*$/.test(value)) {
									setInputValue(value);
									const numValue = value === '' ? 0 : parseInt(value, 10);
									// Update context state (debouncing could be added here if needed)
									if (!isNaN(numValue) && numValue >= 0) {
										setDelay(numValue);
									}
								}
							}}
							onBlur={() => {
								if (inputValue === '') {
									setInputValue('0');
								}
							}}
						/>
						<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
							Add delay to simulate race broadcast delay
						</p>
					</div>
				</div>
			)}
		</div>
	);
};
