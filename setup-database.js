import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function setupDatabase() {
    console.log('🚀 Starting database setup...')

    try {
        // 1. Criar tabela de endereços
        console.log('📍 Creating addresses table...')
        await supabaseAdmin.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS addresses (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                    nickname VARCHAR(100) NOT NULL,
                    cep VARCHAR(9) NOT NULL,
                    street VARCHAR(255) NOT NULL,
                    number VARCHAR(20) NOT NULL,
                    complement VARCHAR(100),
                    neighborhood VARCHAR(100) NOT NULL,
                    city VARCHAR(100) NOT NULL,
                    state VARCHAR(2) NOT NULL,
                    is_default BOOLEAN DEFAULT false,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

                ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS "Users can view own addresses" ON addresses;
                CREATE POLICY "Users can view own addresses" ON addresses
                    FOR SELECT USING (auth.uid() = user_id);

                DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses;
                CREATE POLICY "Users can insert own addresses" ON addresses
                    FOR INSERT WITH CHECK (auth.uid() = user_id);

                DROP POLICY IF EXISTS "Users can update own addresses" ON addresses;
                CREATE POLICY "Users can update own addresses" ON addresses
                    FOR UPDATE USING (auth.uid() = user_id);

                DROP POLICY IF EXISTS "Users can delete own addresses" ON addresses;
                CREATE POLICY "Users can delete own addresses" ON addresses
                    FOR DELETE USING (auth.uid() = user_id);
            `
        })

        // 2. Criar tabela de códigos de verificação
        console.log('🔐 Creating verification_codes table...')
        await supabaseAdmin.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS verification_codes (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                    code VARCHAR(6) NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    new_value TEXT NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    used BOOLEAN DEFAULT false,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);

                ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS "Users can view own verification codes" ON verification_codes;
                CREATE POLICY "Users can view own verification codes" ON verification_codes
                    FOR SELECT USING (auth.uid() = user_id);

                DROP POLICY IF EXISTS "Users can insert own verification codes" ON verification_codes;
                CREATE POLICY "Users can insert own verification codes" ON verification_codes
                    FOR INSERT WITH CHECK (auth.uid() = user_id);

                DROP POLICY IF EXISTS "Users can update own verification codes" ON verification_codes;
                CREATE POLICY "Users can update own verification codes" ON verification_codes
                    FOR UPDATE USING (auth.uid() = user_id);
            `
        })

        // 3. Criar/atualizar tabela de pedidos
        console.log('📦 Creating/updating orders table...')
        await supabaseAdmin.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS orders (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                    details JSONB NOT NULL,
                    total DECIMAL(10, 2) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    address_id UUID REFERENCES addresses(id),
                    tracking_code VARCHAR(100),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
                CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

                ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS "Users can view own orders" ON orders;
                CREATE POLICY "Users can view own orders" ON orders
                    FOR SELECT USING (auth.uid() = user_id);

                DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
                CREATE POLICY "Users can insert own orders" ON orders
                    FOR INSERT WITH CHECK (auth.uid() = user_id);
            `
        })

        // 4. Criar bucket de storage para avatars
        console.log('📸 Creating avatars storage bucket...')
        const { data: buckets } = await supabaseAdmin.storage.listBuckets()
        const avatarBucket = buckets?.find(b => b.name === 'avatars')

        if (!avatarBucket) {
            await supabaseAdmin.storage.createBucket('avatars', {
                public: true,
                fileSizeLimit: 2097152 // 2MB
            })
        }

        console.log('✅ Database setup completed successfully!')
        console.log('\nCreated tables:')
        console.log('  ✓ addresses')
        console.log('  ✓ verification_codes')
        console.log('  ✓ orders')
        console.log('  ✓ avatars (storage bucket)')

    } catch (error) {
        console.error('❌ Error setting up database:', error)
        throw error
    }
}

// Executar setup
setupDatabase()
    .then(() => {
        console.log('\n🎉 All done! You can now use the reseller dashboard.')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Setup failed:', error.message)
        process.exit(1)
    })
