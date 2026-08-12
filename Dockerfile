# Use an official Python base image
FROM python:3.10-slim

# Install system dependencies required by OpenCV and other libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up a new user named "user" with UID 1000 (Hugging Face requirement)
RUN useradd -m -u 1000 user

# Set working directory
WORKDIR /code

# Copy requirements and install dependencies
COPY backend/requirements.txt /code/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/backend/requirements.txt

# Copy the rest of the application files
COPY --chown=user:user . /code

# Create the data directory and ensure it has write permissions
RUN mkdir -p /code/backend/data/gallery && chmod -R 777 /code/backend/data

# Switch to the non-root user
USER user

# Set environment variables
ENV PYTHONPATH=/code/backend
ENV DEV=false

# Expose port 8080 (standard container port)
EXPOSE 8080

# Run the unified server
CMD ["python", "backend/run.py"]
