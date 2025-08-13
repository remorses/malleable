FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files for dependencies
COPY container_src/package.json .

# Install dependencies
RUN bun install

# Copy the server file
COPY container_src/server.ts .

# Expose the port
EXPOSE 8080

# Run the Spiceflow server in interactive mode
ENTRYPOINT ["bun", "run", "-i", "server.ts"]