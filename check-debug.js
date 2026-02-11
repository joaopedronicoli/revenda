
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
    console.log(`Checking last 10 orders...`);

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    orders.forEach(order => {
        console.log('------------------------------------------------');
        console.log(`ID: ${order.id}`);
        console.log(`Status: ${order.status}`);
        console.log(`iPag Status: ${order.ipag_status}`);
        console.log(`iPag TID: ${order.ipag_transaction_id}`);
        if (order.details && order.details.payment_logs) {
            order.details.payment_logs.forEach((log, i) => {
                console.log(`Log ${i} (${log.timestamp}): Success=${log.success}`);
                console.log('Raw Response Snippet:', typeof log.ipag_response_raw === 'string' ? log.ipag_response_raw.substring(0, 300) : JSON.stringify(log.ipag_response_raw).substring(0, 300));
            })
        }
    });

    // Also check recent Credit Card failures
    console.log('\n--- RECENT CREDIT CARD FAILURES ---');
    const { data: ccOrders } = await supabase.from('orders')
        .select('*')
        .eq('payment_method', 'credit_card')
        .order('created_at', { ascending: false })
        .limit(3);

    ccOrders.forEach(order => {
        console.log(`ID: ${order.id}, Status: ${order.status}`);
        if (order.details?.payment_logs) {
            console.log('Last Log Raw:', order.details.payment_logs[order.details.payment_logs.length - 1].ipag_response_raw);
        }
    });
}

check();
