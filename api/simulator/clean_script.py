def clean_data_file(filepath="saved_data.txt"):
    """
    Cleans the specified file to contain only lines starting with
    'DriverList' or 'TimingAppData'.
    """
    try:
        with open(filepath, 'r') as file:
            lines = file.readlines()

        filtered_lines = [
            line for line in lines if line.startswith("['DriverList'") or line.startswith("['TimingData'")
        ]

        with open(filepath, 'w') as file:
            file.writelines(filtered_lines)
        
        print(f"File '{filepath}' cleaned successfully.")

    except FileNotFoundError:
        print(f"Error: File '{filepath}' not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Assuming saved_data.txt is in the same directory as the script
    # or provide the full path if it's elsewhere.
    # For example: clean_data_file(r"c:\path\to\your\saved_data.txt")
    clean_data_file("saved_data.txt")
