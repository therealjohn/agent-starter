# Azure Container Apps Dynamic Sessions - Custom Session Executor
# Provides a secure, isolated environment for agent code execution

FROM node:22-slim

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /workspace

# Copy the session server
COPY server.js /workspace/server.js

# Expose port 8080 (required by Azure Dynamic Sessions)
EXPOSE 8080

CMD ["node", "server.js"]
