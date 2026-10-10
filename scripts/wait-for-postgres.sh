#!/usr/bin/env bash
# wait-for-postgres.sh: Wait for PostgreSQL container to become ready
set -e

host="${1:-db}"
port="${2:-5432}"
user="${3:-tradex_user}"

echo "Waiting for PostgreSQL at $host:$port..."

until pg_isready -h "$host" -p "$port" -U "$user" > /dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping 1s"
  sleep 1
done

echo "PostgreSQL is up and accepting connections!"
