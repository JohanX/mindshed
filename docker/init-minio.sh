#!/bin/sh
# Wait for MinIO to be ready
sleep 3

mc alias set local http://minio:9000 mindshed mindshed123

# Create bucket if it doesn't exist
mc mb --ignore-existing local/mindshed-images

# Set public download policy (for serving images)
mc anonymous set download local/mindshed-images

echo "MinIO initialized: bucket 'mindshed-images' ready."
