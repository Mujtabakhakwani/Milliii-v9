FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Add venv to PATH so all commands use it
ENV PATH="/app/.venv/bin:$PATH"

# Install dependencies to virtual environment
RUN uv sync --frozen --no-dev

# Copy project files
COPY . .

# Expose port
EXPOSE 8080

# Run using uv run to ensure venv is used correctly
CMD ["uv", "run", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "4"]