require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

// 10 sample tech images
const sampleImages = Array.from({ length: 10 }, (_, i) => `sample_tech_${i + 1}.png`);

// GTA (Greater Toronto Area) locations with realistic lat/lng
const gtaLocations = [
    { name: 'MaRS Discovery District, Toronto, ON', lat: 43.6596, lng: -79.3880 },
    { name: 'Shopify Toronto Office, King St W, Toronto, ON', lat: 43.6441, lng: -79.3953 },
    { name: 'George Brown College, Toronto, ON', lat: 43.6513, lng: -79.3701 },
    { name: 'Toronto Reference Library, Toronto, ON', lat: 43.6714, lng: -79.3868 },
    { name: 'Ryerson Student Centre, Toronto, ON', lat: 43.6577, lng: -79.3788 },
    { name: 'Brampton Innovation District, Brampton, ON', lat: 43.6834, lng: -79.7593 },
    { name: 'Square One Shopping Centre, Mississauga, ON', lat: 43.5932, lng: -79.6441 },
    { name: 'Markham Civic Centre, Markham, ON', lat: 43.8561, lng: -79.3370 },
    { name: 'Richmond Hill Centre, Richmond Hill, ON', lat: 43.8710, lng: -79.4379 },
    { name: 'Vaughan Metropolitan Centre, Vaughan, ON', lat: 43.7948, lng: -79.5276 },
    { name: 'Scarborough Town Centre, Scarborough, ON', lat: 43.7751, lng: -79.2578 },
    { name: 'North York Civic Centre, Toronto, ON', lat: 43.7670, lng: -79.4140 },
    { name: 'Oshawa Centre, Oshawa, ON', lat: 43.8971, lng: -78.8658 },
    { name: 'Ajax Community Centre, Ajax, ON', lat: 43.8509, lng: -79.0204 },
    { name: 'Pickering Town Centre, Pickering, ON', lat: 43.8384, lng: -79.0868 },
    { name: 'Burlington Art Centre, Burlington, ON', lat: 43.3255, lng: -79.7990 },
    { name: 'Hamilton Convention Centre, Hamilton, ON', lat: 43.2557, lng: -79.8711 },
    { name: 'Oakville Place Mall, Oakville, ON', lat: 43.4575, lng: -79.6877 },
    { name: 'Etobicoke Civic Centre, Toronto, ON', lat: 43.6205, lng: -79.5132 },
    { name: 'Humber College North Campus, Toronto, ON', lat: 43.7285, lng: -79.6093 },
    { name: 'Seneca College Newnham Campus, Toronto, ON', lat: 43.7946, lng: -79.3490 },
    { name: 'York University Student Centre, Toronto, ON', lat: 43.7735, lng: -79.5019 },
    { name: 'Waterfront Innovation Centre, Toronto, ON', lat: 43.6395, lng: -79.3625 },
    { name: 'Distillery District, Toronto, ON', lat: 43.6503, lng: -79.3596 },
    { name: 'Liberty Village Hub, Toronto, ON', lat: 43.6372, lng: -79.4209 },
    { name: 'Queen West Art Crawl Space, Toronto, ON', lat: 43.6474, lng: -79.4088 },
    { name: 'Corktown Common Pavilion, Toronto, ON', lat: 43.6539, lng: -79.3561 },
    { name: 'Newmarket Community Centre, Newmarket, ON', lat: 44.0592, lng: -79.4613 },
    { name: 'Aurora Cultural Centre, Aurora, ON', lat: 44.0065, lng: -79.4504 },
    { name: 'Whitby Public Library, Whitby, ON', lat: 43.8765, lng: -78.9422 },
    { name: 'Milton Sports Centre, Milton, ON', lat: 43.5183, lng: -79.8828 },
    { name: 'Halton Hills Cultural Centre, Georgetown, ON', lat: 43.6476, lng: -79.9170 },
    { name: 'Stouffville Community Centre, Stouffville, ON', lat: 43.9710, lng: -79.2514 },
    { name: 'Uxbridge Arena, Uxbridge, ON', lat: 44.1085, lng: -79.1195 },
    { name: 'King City Community Centre, King City, ON', lat: 43.9323, lng: -79.5266 },
    { name: 'Caledon Community Complex, Caledon, ON', lat: 43.8613, lng: -79.8741 },
    { name: 'Port Credit Library, Mississauga, ON', lat: 43.5514, lng: -79.5827 },
    { name: 'Streetsville Village Square, Mississauga, ON', lat: 43.5792, lng: -79.7116 },
    { name: 'Unionville Main Street, Markham, ON', lat: 43.8531, lng: -79.3126 },
    { name: 'Don Mills Community Centre, Toronto, ON', lat: 43.7451, lng: -79.3448 },
];

// Event title templates by category
const eventCategories = [
    {
        category: 'AI & Machine Learning', titles: [
            'Intro to Neural Networks', 'GPT Workshop: Build Your Own Chatbot', 'AI Ethics Roundtable',
            'ML Ops Bootcamp', 'Computer Vision Hands-On', 'NLP Deep Dive', 'Generative AI Showcase',
            'AI in Healthcare Panel', 'Reinforcement Learning Lab', 'AI Art Generation Workshop'
        ]
    },
    {
        category: 'Web Development', titles: [
            'React.js Masterclass', 'Vue.js for Beginners', 'Full-Stack Node.js Workshop',
            'Next.js SSR Deep Dive', 'CSS Grid & Flexbox Lab', 'TypeScript Best Practices',
            'GraphQL API Design', 'WebSocket Real-Time Apps', 'Progressive Web Apps Workshop',
            'Tailwind CSS Speed Build'
        ]
    },
    {
        category: 'Cloud & DevOps', titles: [
            'AWS Lambda Serverless Intro', 'Docker & Kubernetes Workshop', 'CI/CD Pipeline Masterclass',
            'Azure Cloud Fundamentals', 'Terraform Infrastructure as Code', 'Microservices Architecture Talk',
            'Cloud Security Best Practices', 'GCP for Startups', 'GitOps Workflow Lab',
            'Monitoring with Prometheus & Grafana'
        ]
    },
    {
        category: 'Data Science', titles: [
            'Python for Data Analysis', 'Pandas & NumPy Crash Course', 'Data Visualization with D3.js',
            'SQL for Analytics', 'Big Data with Apache Spark', 'A/B Testing Workshop',
            'Time Series Forecasting', 'Feature Engineering Techniques', 'Data Storytelling Masterclass',
            'R Programming for Beginners'
        ]
    },
    {
        category: 'Mobile Development', titles: [
            'Flutter Cross-Platform Workshop', 'React Native Hands-On', 'Swift UI for iOS',
            'Kotlin Android Bootcamp', 'Mobile UX Design Sprint', 'AR/VR App Development',
            'Firebase Mobile Backend', 'App Store Optimization Talk', 'Mobile Security Workshop',
            'Wearable Tech Development'
        ]
    },
    {
        category: 'Cybersecurity', titles: [
            'Ethical Hacking 101', 'Network Security Fundamentals', 'Bug Bounty Hunting Workshop',
            'Penetration Testing Lab', 'Zero Trust Architecture Talk', 'Incident Response Drill',
            'Crypto & Blockchain Security', 'OWASP Top 10 Deep Dive', 'SOC Analyst Training',
            'Secure Coding Practices'
        ]
    },
    {
        category: 'Startup & Business', titles: [
            'Pitch Night: Demo Your Startup', 'Lean Startup Methodology', 'Fundraising for Tech Founders',
            'Product-Market Fit Workshop', 'Growth Hacking Strategies', 'UX Research on a Budget',
            'Scaling Your MVP', 'Tech Co-Founder Meetup', 'SaaS Revenue Models',
            'Intellectual Property for Devs'
        ]
    },
    {
        category: 'Blockchain & Web3', titles: [
            'Solidity Smart Contracts 101', 'DeFi Protocol Deep Dive', 'NFT Marketplace Workshop',
            'DAO Governance Models', 'Web3 Frontend with Ethers.js', 'Layer 2 Scaling Solutions',
            'Tokenomics Design Lab', 'Blockchain for Supply Chain', 'Crypto Wallet Development',
            'Cross-Chain Interoperability Talk'
        ]
    },
    {
        category: 'Game Development', titles: [
            'Unity Game Dev Bootcamp', 'Unreal Engine 5 Workshop', 'Pixel Art & Game Design',
            'Multiplayer Networking in Games', 'Godot Engine Intro', 'Game AI Programming',
            'Procedural Generation Lab', 'VR Game Development', 'Game Audio Design Workshop',
            'Indie Game Marketing Panel'
        ]
    },
    {
        category: 'Hardware & IoT', titles: [
            'Raspberry Pi Projects Night', 'Arduino Sensor Workshop', 'IoT Home Automation Lab',
            '3D Printing and Prototyping', 'Drone Programming Workshop', 'FPGA Design Fundamentals',
            'PCB Layout Workshop', 'Edge Computing with IoT', 'Smart City Tech Talk',
            'Robotics Competition Prep'
        ]
    },
];

// Description templates
const descriptionTemplates = [
    'Join us for an exciting hands-on session where you will learn the fundamentals and build real-world projects. Perfect for beginners and intermediate developers looking to level up.',
    'A deep-dive workshop designed for tech enthusiasts who want to explore cutting-edge technologies. Bring your laptop and be ready to code!',
    'Network with fellow developers and industry professionals while learning practical skills you can apply immediately. Refreshments provided.',
    'This intensive session covers everything from theory to implementation. Led by experienced industry practitioners with years of real-world experience.',
    'An interactive meetup featuring live demos, coding challenges, and Q&A sessions. Great opportunity to connect with the local tech community.',
    'Whether you are a seasoned pro or just getting started, this event offers something for everyone. Collaborative learning at its best!',
    'Explore the latest trends and tools in a friendly, inclusive environment. Hands-on exercises with mentors available to help.',
    'A community-driven event focused on practical knowledge sharing. Come prepared to learn, build, and collaborate with amazing people.',
    'Industry experts share their insights and best practices in this information-packed session. Don\'t miss this unique learning opportunity!',
    'Casual yet informative — grab a coffee and join us for an evening of tech talks, demos, and great conversations.',
];

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomFutureDate() {
    const now = new Date();
    const daysAhead = Math.floor(Math.random() * 90) + 1; // 1-90 days in the future
    const hour = 9 + Math.floor(Math.random() * 10); // 9AM - 7PM
    const date = new Date(now);
    date.setDate(date.getDate() + daysAhead);
    date.setHours(hour, 0, 0, 0);
    return date;
}

// Add slight randomness to coords so pins don't overlap
function jitterCoord(coord, range = 0.01) {
    return coord + (Math.random() - 0.5) * range * 2;
}

async function seedSampleData() {
    const client = await pool.connect();
    try {
        console.log('Starting sample data seed...\n');

        const password = 'Manage$123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        let totalUsers = 0;
        let totalEvents = 0;
        let totalSlots = 0;

        // Flatten all event titles for round-robin usage
        const allTitles = [];
        eventCategories.forEach(cat => {
            cat.titles.forEach(title => allTitles.push(title));
        });

        await client.query('BEGIN');

        for (let i = 1; i <= 100; i++) {
            const username = `test${i}`;
            const email = `test${i}@ybyvibe.com`;

            // Insert user
            const userResult = await client.query(`
                INSERT INTO "Users" (username, email, password_hash, role)
                VALUES ($1, $2, $3, 'user')
                ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
                RETURNING id
            `, [username, email, passwordHash]);

            const userId = userResult.rows[0].id;
            totalUsers++;

            // Create 2 events per user
            for (let j = 0; j < 2; j++) {
                const titleIndex = ((i - 1) * 2 + j) % allTitles.length;
                const title = allTitles[titleIndex];
                const description = randomItem(descriptionTemplates);
                const location = randomItem(gtaLocations);
                const image = sampleImages[(i * 2 + j) % sampleImages.length];
                const requiresApproval = Math.random() > 0.7; // 30% require approval

                const eventResult = await client.query(`
                    INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id
                `, [
                    title,
                    description,
                    location.name,
                    jitterCoord(location.lat),
                    jitterCoord(location.lng),
                    userId,
                    image,
                    requiresApproval
                ]);

                const eventId = eventResult.rows[0].id;
                totalEvents++;

                // Create 1-3 time slots per event
                const numSlots = 1 + Math.floor(Math.random() * 3);
                for (let k = 0; k < numSlots; k++) {
                    const startDate = randomFutureDate();
                    startDate.setDate(startDate.getDate() + k); // spread slots across days
                    const duration = [60, 90, 120][Math.floor(Math.random() * 3)];
                    const maxAttendees = [5, 10, 15, 20, 25, 30][Math.floor(Math.random() * 6)];

                    await client.query(`
                        INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
                        VALUES ($1, $2, $3, $4)
                    `, [eventId, startDate.toISOString(), duration, maxAttendees]);
                    totalSlots++;
                }
            }

            if (i % 10 === 0) {
                process.stdout.write(`  Created ${i}/100 users with events...\r`);
            }
        }

        await client.query('COMMIT');

        console.log('\n\n✅ Sample data seeded successfully!');
        console.log(`   👤 Users created:     ${totalUsers}`);
        console.log(`   📅 Events created:    ${totalEvents}`);
        console.log(`   🕐 Time slots created: ${totalSlots}`);
        console.log('\n   All users: test1 - test100');
        console.log('   All emails: test1@ybyvibe.com - test100@ybyvibe.com');
        console.log('   All passwords: manage\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding sample data:', error);
    } finally {
        client.release();
        pool.end();
    }
}

seedSampleData();
