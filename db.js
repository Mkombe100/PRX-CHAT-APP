const { Pool } = require("pg");

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_MO8ocymVLQx0@ep-proud-moon-adtdpbjy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = pool;