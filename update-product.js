// Script para atualizar produto de R$ 1,00 para R$ 5,00
const SUPABASE_URL = 'https://bpbklahbndoycbxehqwi.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYmtsYWhibmRveWNieGVocXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5NDUwNTcsImV4cCI6MjA1MzUyMTA1N30.hxSr_JUi9QOoBpzr7B_6OjOlUkbhRpjdYohKQNWpsjk'

async function updateProduct() {
    try {
        // Buscar produto de R$ 1
        const selectResponse = await fetch(`${SUPABASE_URL}/rest/v1/products?price=eq.1.00&limit=1`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        })

        const products = await selectResponse.json()

        if (!products || products.length === 0) {
            console.log('❌ Nenhum produto de R$ 1,00 encontrado')
            return
        }

        const product = products[0]
        console.log('📦 Produto encontrado:', product.name, '- ID:', product.id)

        // Atualizar para R$ 5,00 sem desconto
        const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${product.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                price: 5.00,
                discount_percentage: 0
            })
        })

        const updated = await updateResponse.json()

        if (updateResponse.ok) {
            console.log('✅ Produto atualizado com sucesso!')
            console.log('   Preço: R$ 5,00')
            console.log('   Desconto: 0%')
        } else {
            console.error('❌ Erro ao atualizar:', updated)
        }
    } catch (error) {
        console.error('❌ Erro:', error.message)
    }
}

updateProduct()
