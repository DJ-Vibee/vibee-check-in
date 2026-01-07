// Test JotForm API with correct vibee subdomain
const https = require('https');

const API_KEY = 'e1a6244860ef0e6def48b0b98f295817';
const FORM_ID = '251891714013958';

function fetch(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'vibee.jotform.com',
            path: `/API${endpoint}`,
            method: 'GET',
            headers: {
                'APIKEY': API_KEY,
                'Content-Type': 'application/json'
            }
        };

        console.log(`Fetching: https://vibee.jotform.com/API${endpoint}`);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.log('Raw:', data.substring(0, 200));
                    resolve({ error: 'parse error' });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log('=== Testing JotForm API (vibee subdomain) ===\n');

    // Test form access
    console.log('1. Getting form info...');
    const form = await fetch(`/form/${FORM_ID}`);
    if (form.responseCode === 200) {
        console.log('   ✓ SUCCESS!');
        console.log(`   Form: ${form.content.title}`);
        console.log(`   Submissions: ${form.content.count}\n`);
    } else {
        console.log('   Error:', form.message || JSON.stringify(form));
        return;
    }

    // Get submissions
    console.log('2. Fetching submissions...');
    const subs = await fetch(`/form/${FORM_ID}/submissions?limit=5`);
    if (subs.responseCode === 200) {
        console.log(`   ✓ Got ${subs.content.length} submissions\n`);

        subs.content.slice(0, 2).forEach((sub, i) => {
            console.log(`   Submission ${i + 1} (ID: ${sub.id}):`);
            const answers = sub.answers || {};
            Object.values(answers).forEach(a => {
                if (a.answer) {
                    const val = typeof a.answer === 'object' ? JSON.stringify(a.answer) : a.answer;
                    console.log(`     - ${a.name || 'field'}: "${String(val).substring(0, 50)}"`);
                }
            });
            console.log('');
        });
    }

    console.log('=== API Connection Working! ===');
}

main().catch(console.error);
