FROM --platform=linux/amd64 oven/bun:latest


WORKDIR /app

# Copy package files for dependencies
COPY bun.package.json ./package.json

# Install dependencies
RUN bun install

# Copy bunfig.toml
COPY bunfig.toml .

# Copy the source files
COPY src/ ./src/

RUN ls .

# Expose the port
EXPOSE 8080

# Run the Spiceflow server in interactive mode
ENTRYPOINT ["bun", "run", "-i", "src/bun-server.tsx"]
