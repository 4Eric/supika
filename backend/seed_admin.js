const { poolPromise } = require('./config/db');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
    try {
        const pool = await poolPromise;
        const password = 'Manage$123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await pool.query(`
            INSERT INTO "Users" (username, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO UPDATE 
            SET role = EXCLUDED.role,
                password_hash = EXCLUDED.password_hash
            RETURNING id, username, email, role
        `, ['admin', 'admin@ybyvibe.com', passwordHash, 'admin']);

        console.log('Admin user seeded successfully:', result.rows[0]);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin user:', error);
        process.exit(1);
    }
}

seedAdmin();
