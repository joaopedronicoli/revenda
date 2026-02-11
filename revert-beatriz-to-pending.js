import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rrgrkbjmoezpesqnjilk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function revertToPending() {
  const beatrizUserId = 'd1769113-a87f-47f6-8a0a-86c5b3054f7a'

  const { error } = await supabase
    .from('user_approvals')
    .update({
      approval_status: 'pending',
      approved_at: null
    })
    .eq('user_id', beatrizUserId)

  if (error) {
    console.error('Erro:', error)
  } else {
    console.log('✅ Beatriz revertida para pending')
  }
}

revertToPending().catch(console.error)
