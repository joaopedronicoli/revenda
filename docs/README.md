# Documentação - Revenda Patrícia Elias

Esta pasta contém toda a documentação técnica do projeto.

## 📚 Índice

### Deployment e Infraestrutura
- **[DEPLOY.md](./DEPLOY.md)** - Guia completo de deploy e procedimentos de emergência
- **[SERVER_COMMANDS.md](./SERVER_COMMANDS.md)** - Comandos rápidos para uso no servidor
- **[ENV_SETUP.md](./ENV_SETUP.md)** - Configuração de variáveis de ambiente

### Configuração do Banco de Dados
- **[FIX_ADMIN_RLS.md](./FIX_ADMIN_RLS.md)** - Configuração de políticas RLS para administradores

## 🚀 Quick Start

Para fazer deploy de alterações:

```bash
# No seu computador
git add . && git commit -m "mensagem" && git push origin main

# No servidor
ssh root@servidor
cd /opt/apps/revenda-patriciaelias
./deploy.sh
```

## 📖 Documentação Adicional

- [README.md](../README.md) - Visão geral do projeto
- [SUPABASE-SETUP.md](../SUPABASE-SETUP.md) - Configuração do Supabase
- [N8N-SETUP.md](../N8N-SETUP.md) - Configuração do N8N
- [DEPLOY-EDGE-FUNCTIONS.md](../DEPLOY-EDGE-FUNCTIONS.md) - Deploy de Edge Functions

## 🆘 Emergências

Em caso de problemas, consulte a seção **Procedimentos de Emergência** no [DEPLOY.md](./DEPLOY.md).
