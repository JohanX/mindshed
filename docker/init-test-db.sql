-- Create the test database (runs once on first container start)
SELECT 'CREATE DATABASE mindshed_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mindshed_test')\gexec

-- Grant same user access
GRANT ALL PRIVILEGES ON DATABASE mindshed_test TO mindshed;
