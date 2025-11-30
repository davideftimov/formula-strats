import React from "react";

interface NumberInputProps {
	id: string;
	label: string;
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
	description?: string;
	pattern: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
	id,
	label,
	value,
	onChange,
	onBlur,
	description,
	pattern,
}) => (
	<div className="">
		<label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
			{label}
		</label>
		<input
			id={id}
			type="text"
			inputMode="numeric"
			pattern={pattern}
			className="w-full border border-zinc-300 dark:border-zinc-600 p-2 bg-white dark:bg-zinc-800 focus:outline-none text-zinc-700 dark:text-zinc-200"
			value={value}
			onChange={onChange}
			onBlur={onBlur}
		/>
		{description && (
			<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
				{description}
			</p>
		)}
	</div>
);
