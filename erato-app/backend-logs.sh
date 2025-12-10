#!/bin/bash

# Backend logs script for Erato
# Usage: ./backend-logs.sh [--tail N] [--no-follow] [--dev|--prod]

# Default values
FOLLOW=true
TAIL=100
ENV="auto"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tail)
      TAIL="$2"
      shift 2
      ;;
    --no-follow)
      FOLLOW=false
      shift
      ;;
    --dev)
      ENV="dev"
      shift
      ;;
    --prod)
      ENV="prod"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --tail N          Show last N lines (default: 100)"
      echo "  --no-follow       Don't follow logs, just show and exit"
      echo "  --dev             Use development container (erato-backend-dev)"
      echo "  --prod            Use production container (erato-backend)"
      echo "  -h, --help        Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                # Follow logs with last 100 lines (auto-detect env)"
      echo "  $0 --tail 50      # Follow logs with last 50 lines"
      echo "  $0 --no-follow    # Show last 100 lines and exit"
      echo "  $0 --dev          # Use dev container explicitly"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Auto-detect environment if not specified
if [ "$ENV" = "auto" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^erato-backend-dev$"; then
    ENV="dev"
    echo "Detected development environment"
  elif docker ps --format '{{.Names}}' | grep -q "^erato-backend$"; then
    ENV="prod"
    echo "Detected production environment"
  else
    echo "Error: No backend container found (checked erato-backend-dev and erato-backend)"
    echo "Make sure your Docker containers are running."
    exit 1
  fi
fi

# Set container name based on environment
if [ "$ENV" = "dev" ]; then
  CONTAINER="erato-backend-dev"
else
  CONTAINER="erato-backend"
fi

# Check if container exists
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: Container '$CONTAINER' is not running"
  echo "Available containers:"
  docker ps --format '  {{.Names}}'
  exit 1
fi

# Build docker logs command
CMD="docker logs --tail ${TAIL}"

if [ "$FOLLOW" = true ]; then
  CMD="${CMD} -f"
fi

CMD="${CMD} ${CONTAINER}"

echo "Showing logs for: ${CONTAINER}"
echo "Command: ${CMD}"
echo "---"
echo ""

# Execute the command
exec $CMD
