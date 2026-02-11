
import { createClient } from '@supabase/supabase-js';

// Hardcoded for reliability in this script context
const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    console.log('--- LISTING LAST 5 ORDERS ---');
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    if (orders && orders.length > 0) {
        orders.forEach(order => {
            console.log(`\n------------------------------------------------`);
            console.log(`ID: ${order.id}`);
            console.log(`Method: ${order.payment_method}`);
            console.log(`Status: ${order.status} (iPag: ${order.ipag_status})`);
            console.log(`Transaction ID: ${order.ipag_transaction_id}`);
            console.log(`Created: ${order.created_at}`);

            if (order.details && order.details.payment_logs) {
                console.log('--- PAYMENT LOGS ---');
                order.details.payment_logs.forEach(log => {
                    console.log(`[${log.timestamp}] Raw Response Snippet: ${log.ipag_response_raw?.substring(0, 500)}...`);
                    if (log.parsed_response && (log.parsed_response.message || log.parsed_response.error)) {
                        console.log(`Error Message: ${log.parsed_response.message || log.parsed_response.error}`);
                    }
                });
            } else {
                console.log('No payment logs.');
            }
        });
    } else {
        console.log('No orders found.');
    }
}

check();
