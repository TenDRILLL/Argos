import {createPool, Pool, PoolConnection} from "mariadb";

let pool: Pool;

async function initDatabase(): Promise<void> {
    pool = createPool({host: process.env.DB_HOST as string, port: parseInt(process.env.DB_PORT as string), user: process.env.DB_USER as string, password: process.env.DB_PASS as string, database: process.env.DB_NAME});

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS discordToken (
        id VARCHAR(20) NOT NULL PRIMARY KEY,
        access_token VARCHAR(200) NOT NULL,
        expires_in INT NOT NULL,
        expires_at BIGINT NULL,
        refresh_token VARCHAR(200) NOT NULL,
        scope VARCHAR(200) NOT NULL,
        token_type VARCHAR(20) NOT NULL
        );
    `);

    await dbQuery(`ALTER TABLE discordToken MODIFY COLUMN scope VARCHAR(200) NOT NULL`).catch(() => {});
    await dbQuery(`ALTER TABLE discordToken MODIFY COLUMN token_type VARCHAR(20) NOT NULL`).catch(() => {});

    const schemaCheck = await dbQuery(
        "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='discord_id'"
    );
    const hasNewSchema = parseInt(schemaCheck[0].cnt) > 0;
    if(!hasNewSchema){
        console.log("Stale or missing users schema — rebuilding affected tables.");
        const refs = await dbQuery(
            "SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='users'"
        );
        const conn = await pool.getConnection();
        try {
            await conn.query("SET FOREIGN_KEY_CHECKS=0");
            for(const ref of refs){
                await conn.query(`DROP TABLE IF EXISTS \`${ref.TABLE_NAME}\``);
                console.log(`Dropped FK dependent table: ${ref.TABLE_NAME}`);
            }
            await conn.query("DROP TABLE IF EXISTS user_activities");
            await conn.query("DROP TABLE IF EXISTS user_tokens");
            await conn.query("DROP TABLE IF EXISTS users");
            await conn.query("SET FOREIGN_KEY_CHECKS=1");
        } finally {
            await conn.release();
        }
    }

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS users (
        discord_id      VARCHAR(20)  NOT NULL PRIMARY KEY,
        bungie_id       VARCHAR(20)  NULL,
        destiny_id      VARCHAR(20)  NULL,
        destiny_name    VARCHAR(100) NULL,
        membership_type TINYINT      NULL,
        in_clan         VARCHAR(20)  NULL,
        guardian_rank   TINYINT      DEFAULT 1,
        timezone        VARCHAR(50)  NULL,
        stats_kd        FLOAT        DEFAULT 0,
        stats_light     INT          DEFAULT 0
        );
    `);

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS user_tokens (
        discord_id      VARCHAR(20)  NOT NULL PRIMARY KEY,
        access_token    VARCHAR(500) NOT NULL,
        access_expiry   BIGINT       NOT NULL,
        refresh_token   VARCHAR(500) NOT NULL,
        refresh_expiry  BIGINT       NOT NULL
        );
    `);

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS user_activities (
        discord_id      VARCHAR(20)  NOT NULL,
        activity_key    VARCHAR(100) NOT NULL,
        activity_type   TINYINT      NOT NULL,
        clears          INT          DEFAULT 0,
        PRIMARY KEY (discord_id, activity_key)
        );
    `);

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS lfg (
        id              VARCHAR(50)  NOT NULL PRIMARY KEY,
        activity        VARCHAR(100) NOT NULL,
        scheduled       BIGINT       NOT NULL,
        max_size        TINYINT      NOT NULL,
        creator         VARCHAR(20)  NOT NULL,
        description     TEXT         NULL
        );
    `);

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS lfg_members (
        lfg_id          VARCHAR(50)  NOT NULL,
        discord_id      VARCHAR(20)  NOT NULL,
        queued          BOOLEAN      DEFAULT FALSE,
        PRIMARY KEY (lfg_id, discord_id)
        );
    `);

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS misc (
        key_name        VARCHAR(50)  NOT NULL PRIMARY KEY,
        value           MEDIUMTEXT   NOT NULL
        );
    `);

    console.table({
        discordToken:    {created: true},
        users:           {created: true},
        user_tokens:     {created: true},
        user_activities: {created: true},
        lfg:             {created: true},
        lfg_members:     {created: true},
        misc:            {created: true},
    });
}

function dbQuery(query: string, values?: any[]): Promise<any[]>{
    return new Promise(async (res, rej) => {
        let connection: PoolConnection;
        try {
            connection = await pool.getConnection();
            const results = values ? await connection.query(query,values) : await connection.query(query);
            res(results);
        } catch (err){
            rej(err);
        } finally {
            //@ts-ignore
            if(connection) await connection.release();
        }
    });
}

async function dbTransaction(callback: (tx: (query: string, values?: any[]) => Promise<any>) => Promise<void>): Promise<void> {
    const connection: PoolConnection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const tx = (query: string, values?: any[]) =>
            values ? connection.query(query, values) : connection.query(query);
        await callback(tx);
        await connection.commit();
    } catch (err) {
        await connection.rollback().catch(() => {});
        throw err;
    } finally {
        await connection.release();
    }
}

export {initDatabase, dbQuery, dbTransaction}
