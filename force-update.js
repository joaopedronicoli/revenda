
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function forceUpdate() {
    const orderId = '16bc5092-034f-46b9-a275-eb03cf10d91c';
    console.log(`Force updating order ${orderId} to PAID...`);

    const { error } = await supabase
        .from('orders')
        .update({
            status: 'paid',
            ipag_status: 'approved',
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    if (error) {
        console.error('Error updating:', error);
    } else {
        console.log('Success! Order is now PAID.');
    }
}

forceUpdate();
