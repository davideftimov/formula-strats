const isDev = import.meta.env.MODE === 'development';

type LogArgs = unknown[];

interface Logger {
	log: (...args: LogArgs) => void;
	warn: (...args: LogArgs) => void;
	error: (...args: LogArgs) => void;
}

export const logger: Logger = {
	log: (...args) => isDev && console.log('[LOG]', ...args),
	warn: (...args) => isDev && console.warn('[WARN]', ...args),
	error: (...args) => console.error('[ERROR]', ...args),
};
