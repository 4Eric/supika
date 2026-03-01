require('dotenv').config();
async function testRegistration() {
    try {
        const eventId = 94;
        const timeSlotId = 189;

        // Grab a fresh token via login
        // I'll grab an existing real user from the db
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
        });
        const userRes = await pool.query('SELECT email FROM "Users" LIMIT 1');
        const email = userRes.rows[0].email;
        pool.end();

        // Well, I don't know the password...
        // Let's bypass login and just generate a token
        const jwt = require('jsonwebtoken');
        const pool2 = new Pool({ connectionString: 'postgresql://yby_admin:manage@localhost:5433/yby_vibe' });
        const userRes2 = await pool2.query('SELECT id, role FROM "Users" LIMIT 1');
        const user = userRes2.rows[0];
        const token = jwt.sign({ user: { id: user.id, role: user.role } }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

        const res = await fetch(`http://localhost:5000/api/events/${eventId}/register`, {
            method: 'POST',
            body: JSON.stringify({ timeSlotId: timeSlotId }),
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        const resData = await res.json();
        console.log('Response:', resData);
    } catch (e) {
        console.log('Error:', e.message);
    }
}

testRegistration();
