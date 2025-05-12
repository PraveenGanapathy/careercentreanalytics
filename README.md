# Career Centre Analytics

A web application for tracking and visualizing career center metrics across different categories and time periods.

## Features

- Interactive dashboard for visualizing metrics data
- Quarterly and yearly views of performance metrics
- Data entry form for adding and updating metrics
- Azure Blob Storage integration for data persistence

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript, Bootstrap 5, D3.js
- **Backend**: Flask (Python)
- **Storage**: Azure Blob Storage
- **Data Processing**: OpenPyXL for Excel manipulation

## Installation

1. Clone the repository
2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   Create a `.env` file with:
   ```
   AZURE_STORAGE_CONNECTION_STRING=your_connection_string
   AZURE_CONTAINER_NAME=your_container_name
   AZURE_BLOB_NAME=your_blob_name
   ```

## Usage

1. Run the application:
   ```
   python app.py
   ```
2. Access the dashboard at http://localhost:5000
3. Use the data entry form at http://localhost:5000/form to add metrics

## Live Demo

![Kapture 2025-05-12 at 10 01 54](https://github.com/user-attachments/assets/9fa148ae-7ff7-45f6-8739-a521207105d6)


## Project Structure

- `/static`: CSS and JavaScript files
- `/templates`: HTML templates
- `app.py`: Main Flask application
- `requirements.txt`: Python dependencies

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.
