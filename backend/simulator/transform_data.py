import json

def extract_data(filepath, save_path):
    try:
        with open(save_path, 'w', encoding='utf-8') as f_out:  # Open output file once
            with open(filepath, 'r', encoding='utf-8') as f_in:  # Input file
                for line_number, line_content in enumerate(f_in, 1):
                    line_content = line_content.strip()
                    if not line_content:
                        continue

                    # The JSON part starts after the first '{'
                    try:
                        json_part_index = line_content.index('{')
                        json_str = line_content[json_part_index:]
                        # print(f"Processing line {line_number}: {json_str}")
                        # Write to the output file, add a newline
                        f_out.write(f"['DriverList', {json_str}, '2025-05-16T15:00:05.883Z']\n")
                    except ValueError:
                        # This happens if '{' is not found or line is malformed before JSON
                        # print(f"Warning: Line {line_number} does not contain JSON object or malformed: {line_content}")
                        continue

    except FileNotFoundError:
        print(f"Error: File not found at {filepath}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == '__main__':
    save_file_path = 'test_data_session.txt'

    extract_data("SessionInfo.jsonStream", save_file_path)