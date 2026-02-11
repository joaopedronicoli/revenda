// Script para testar conexão com Supabase
import { createClient } from '@supabase/supabase-js'

// Carregar variáveis de ambiente
const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjU2OTMsImV4cCI6MjA4NTE0MTY5M30.C9TEOaHumFN3lob33wUYEB_68SNmRplQlIyjmAir_ns'

console.log('🔍 Testando conexão com Supabase...\n')
console.log('URL:', SUPABASE_URL)
console.log('ANON_KEY (primeiros 50 chars):', SUPABASE_ANON_KEY.substring(0, 50) + '...\n')

// Criar cliente
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testConnection() {
    try {
        console.log('1️⃣ Testando conexão básica...')

        // Testar query simples
        const { data, error } = await supabase
            .from('addresses')
            .select('count')
            .limit(1)

        if (error) {
            console.error('❌ Erro na query:', error.message)
            console.error('Detalhes:', error)
            return false
        }

        console.log('✅ Conexão com banco OK!\n')

        // Testar autenticação
        console.log('2️⃣ Testando sistema de autenticação...')

        const { data: session, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
            console.error('❌ Erro ao verificar sessão:', sessionError.message)
            return false
        }

        console.log('✅ Sistema de autenticação OK!')
        console.log('Sessão atual:', session.session ? 'Logado' : 'Não logado\n')

        // Testar criação de usuário (apenas simulação)
        console.log('3️⃣ Verificando se email signup está habilitado...')

        // Tentar signup com email fake para ver se retorna erro específico
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: 'test-' + Date.now() + '@example.com',
            password: 'test123456',
            options: {
                data: {
                    name: 'Test User'
                }
            }
        })

        if (signupError) {
            if (signupError.message.includes('Email signups are disabled')) {
                console.error('❌ PROBLEMA ENCONTRADO: Email signup está DESABILITADO no Supabase!')
                console.error('   Você precisa habilitar em: Authentication > Providers > Email')
                return false
            } else {
                console.error('❌ Erro no signup:', signupError.message)
                return false
            }
        }

        console.log('✅ Email signup está habilitado!')
        console.log('Usuário de teste criado:', signupData.user?.email || 'N/A\n')

        console.log('\n✅ TODAS AS VERIFICAÇÕES PASSARAM!')
        console.log('As credenciais estão corretas e o Supabase está configurado.\n')

        return true

    } catch (err) {
        console.error('❌ Erro inesperado:', err.message)
        console.error(err)
        return false
    }
}

testConnection()
