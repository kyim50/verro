#!/bin/bash

# Supabase Automated Backup Script
# This script creates backups of your Supabase database and stores them securely

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - load from environment or config file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/backup.config"

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    echo -e "${RED}Error: backup.config not found${NC}"
    echo -e "${YELLOW}Please create backup.config with your Supabase and AWS settings${NC}"
    exit 1
fi

# Validate required variables
validate_config() {
    required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_KEY" "AWS_REGION" "S3_BUCKET_NAME")
    for var in required_vars; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}Error: $var must be set in backup.config${NC}"
            exit 1
        fi
    done
}

# Extract database connection details from Supabase URL
extract_db_details() {
    # Parse Supabase URL to get project reference
    PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')

    DB_HOST="db.$PROJECT_REF.supabase.co"
    DB_PORT="5432"
    DB_NAME="postgres"
    DB_USER="postgres"
}

# Create backup directory
setup_backup_directory() {
    BACKUP_DIR="${BACKUP_DIR:-/tmp/supabase-backups}"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

    mkdir -p "$BACKUP_DIR"
    echo -e "${BLUE}Backup directory: $BACKUP_DIR${NC}"
}

# Export database schema
backup_schema() {
    echo -e "${BLUE}Creating schema backup...${NC}"

    PGPASSWORD="$SUPABASE_SERVICE_KEY" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --schema-only \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        --verbose \
        --file="$BACKUP_DIR/schema_$TIMESTAMP.sql"

    echo -e "${GREEN}Schema backup completed${NC}"
}

# Export database data (with options for large databases)
backup_data() {
    echo -e "${BLUE}Creating data backup...${NC}"

    # For very large databases, consider excluding large tables or using parallel dumps
    # You can modify this to backup specific tables or use different strategies

    PGPASSWORD="$SUPABASE_SERVICE_KEY" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --data-only \
        --no-owner \
        --no-privileges \
        --verbose \
        --compress=9 \
        --format=custom \
        --file="$BACKUP_DIR/data_$TIMESTAMP.dump"

    echo -e "${GREEN}Data backup completed${NC}"
}

# Create a full backup (schema + data in one file)
backup_full() {
    echo -e "${BLUE}Creating full backup...${NC}"

    PGPASSWORD="$SUPABASE_SERVICE_KEY" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --no-owner \
        --no-privileges \
        --verbose \
        --compress=9 \
        --format=custom \
        --file="$BACKUP_DIR/full_$TIMESTAMP.dump"

    echo -e "${GREEN}Full backup completed${NC}"
}

# Compress backup files
compress_backups() {
    echo -e "${BLUE}Compressing backup files...${NC}"

    # Compress individual files
    if [ -f "$BACKUP_DIR/schema_$TIMESTAMP.sql" ]; then
        gzip "$BACKUP_DIR/schema_$TIMESTAMP.sql"
        echo -e "${GREEN}Schema backup compressed${NC}"
    fi

    if [ -f "$BACKUP_DIR/data_$TIMESTAMP.dump" ]; then
        gzip "$BACKUP_DIR/data_$TIMESTAMP.dump"
        echo -e "${GREEN}Data backup compressed${NC}"
    fi

    if [ -f "$BACKUP_DIR/full_$TIMESTAMP.dump" ]; then
        gzip "$BACKUP_DIR/full_$TIMESTAMP.dump"
        echo -e "${GREEN}Full backup compressed${NC}"
    fi
}

# Upload backups to S3
upload_to_s3() {
    echo -e "${BLUE}Uploading backups to S3...${NC}"

    # Create S3 path with date
    S3_PATH="s3://$S3_BUCKET_NAME/supabase/$(date +"%Y/%m/%d")/"

    # Upload all compressed files
    for file in "$BACKUP_DIR"/*"$TIMESTAMP"*.gz; do
        if [ -f "$file" ]; then
            aws s3 cp "$file" "$S3_PATH" --region "$AWS_REGION"
            echo -e "${GREEN}Uploaded $(basename "$file") to S3${NC}"
        fi
    done
}

# Clean up old local backups
cleanup_local() {
    echo -e "${BLUE}Cleaning up old local backups...${NC}"

    # Keep only last 7 days of local backups
    find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
    find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
    find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete

    echo -e "${GREEN}Local cleanup completed${NC}"
}

# Clean up old S3 backups (optional - can be expensive for large backups)
cleanup_s3() {
    if [ "${S3_RETENTION_DAYS:-0}" -gt 0 ]; then
        echo -e "${BLUE}Cleaning up old S3 backups...${NC}"

        # Delete backups older than retention period
        aws s3 rm "s3://$S3_BUCKET_NAME/supabase/" \
            --recursive \
            --exclude "*" \
            --include "*" \
            --region "$AWS_REGION" \
            --dryrun  # Remove --dryrun to actually delete

        echo -e "${GREEN}S3 cleanup completed (dry run)${NC}"
    fi
}

# Verify backup integrity
verify_backup() {
    echo -e "${BLUE}Verifying backup integrity...${NC}"

    # Check if files exist and are not empty
    for file in "$BACKUP_DIR"/*"$TIMESTAMP"*.gz; do
        if [ -f "$file" ]; then
            if [ -s "$file" ]; then
                echo -e "${GREEN}✓ $(basename "$file") is valid${NC}"
            else
                echo -e "${RED}✗ $(basename "$file") is empty${NC}"
                return 1
            fi
        fi
    done
}

# Send notification (optional - requires mail setup)
send_notification() {
    local subject="$1"
    local message="$2"

    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "$subject" "$NOTIFICATION_EMAIL"
    fi
}

# Main backup function
main() {
    echo -e "${BLUE}🚀 Starting Supabase backup at $(date)${NC}"

    validate_config
    extract_db_details
    setup_backup_directory

    # Perform backups
    backup_schema
    backup_data
    backup_full

    # Compress and upload
    compress_backups
    upload_to_s3

    # Verify and cleanup
    verify_backup
    cleanup_local
    cleanup_s3

    echo -e "${GREEN}✅ Supabase backup completed successfully at $(date)${NC}"

    # Send success notification
    send_notification "Supabase Backup Success" "Backup completed successfully at $(date)"
}

# Error handling
error_exit() {
    echo -e "${RED}❌ Backup failed at $(date)${NC}"
    send_notification "Supabase Backup Failed" "Backup failed at $(date). Check logs for details."
    exit 1
}

# Set error trap
trap error_exit ERR

# Handle command line arguments
case "${1:-}" in
    "schema")
        validate_config
        extract_db_details
        setup_backup_directory
        backup_schema
        compress_backups
        upload_to_s3
        ;;
    "data")
        validate_config
        extract_db_details
        setup_backup_directory
        backup_data
        compress_backups
        upload_to_s3
        ;;
    "full")
        validate_config
        extract_db_details
        setup_backup_directory
        backup_full
        compress_backups
        upload_to_s3
        ;;
    "cleanup")
        cleanup_local
        cleanup_s3
        ;;
    *)
        main
        ;;
esac