# Como Publicar Alterações no Servidor

Este guia mostra o passo a passo completo para publicar alterações do código no servidor de produção.

## 📋 Pré-requisitos

- Acesso SSH ao servidor
- Alterações já commitadas e enviadas para o GitHub

---

## 🚀 Opção 1: Usando o Script de Deploy (Recomendado)

### No Servidor:

```bash
# 1. Conectar ao servidor via SSH
ssh root@seu-servidor.com

# 2. Ir para o diretório do projeto
cd /opt/apps/revenda-patriciaelias

# 3. Executar o script de deploy
./deploy.sh
```

**Pronto!** O script vai:
- Fazer `git pull` para baixar as alterações
- Buildar a nova imagem Docker
- Atualizar o serviço no Swarm

---

## 🔧 Opção 2: Comandos Manuais

Se preferir executar passo a passo:

```bash
# 1. Conectar ao servidor
ssh root@seu-servidor.com

# 2. Ir para o diretório do projeto
cd /opt/apps/revenda-patriciaelias

# 3. Baixar as alterações do GitHub
git pull

# 4. Rebuildar a imagem Docker
docker build --no-cache -t patricia-elias-reseller-app:latest .

# 5. Atualizar o serviço
docker stack deploy -c docker-compose.yml patricia-elias
```

---

## 📝 Workflow Completo (Do Desenvolvimento ao Servidor)

### 1. No seu computador local:

```bash
# Fazer alterações no código
# ...

# Adicionar arquivos ao git
git add .

# Fazer commit
git commit -m "descrição das alterações"

# Enviar para o GitHub
git push origin main
```

### 2. No servidor:

```bash
# Conectar ao servidor
ssh root@seu-servidor.com

# Ir para o diretório
cd /opt/apps/revenda-patriciaelias

# Executar deploy
./deploy.sh
```

---

## 🔍 Verificar se o Deploy Funcionou

```bash
# Ver status dos serviços
docker stack ps patricia-elias

# Ver logs em tempo real
docker service logs patricia-elias_frontend -f

# Ver últimas 50 linhas de log
docker service logs patricia-elias_frontend --tail 50

# Verificar se o container está rodando
docker ps | grep patricia-elias
```

---

## ⚠️ Troubleshooting

### Se o build falhar:

```bash
# Ver logs completos do build
docker build -t patricia-elias-reseller-app:latest .

# Limpar cache do Docker e tentar novamente
docker system prune -a
docker build --no-cache -t patricia-elias-reseller-app:latest .
```

### Se o serviço não atualizar:

```bash
# Forçar atualização do serviço
docker service update --force patricia-elias_frontend

# Ou remover e recriar a stack
docker stack rm patricia-elias
# Aguardar 10 segundos
docker stack deploy -c docker-compose.yml patricia-elias
```

### Se precisar reverter para versão anterior:

```bash
# Voltar para commit anterior
git log --oneline  # Ver histórico
git checkout <hash-do-commit>
./deploy.sh
```

---

## 📊 Comandos Úteis

```bash
# Ver todas as stacks rodando
docker stack ls

# Ver serviços de uma stack
docker stack services patricia-elias

# Ver detalhes de um serviço
docker service inspect patricia-elias_frontend

# Ver uso de recursos
docker stats

# Limpar recursos não utilizados
docker system prune
```

---

## 🔄 Fluxo Rápido (Resumo)

**Local:**
```bash
git add . && git commit -m "mensagem" && git push origin main
```

**Servidor:**
```bash
ssh root@servidor && cd /opt/apps/revenda-patriciaelias && ./deploy.sh
```

---

## 📌 Notas Importantes

1. **Sempre teste localmente** antes de fazer push para produção
2. **O `.env.production` não vai para o Git** - se adicionar novas variáveis, atualize manualmente no servidor
3. **Backup antes de grandes mudanças** - faça snapshot do servidor se possível
4. **Monitore os logs** após o deploy para verificar se está tudo funcionando
5. **Acesse https://revenda.pelg.com.br** para testar a aplicação

---

## 🆘 Procedimentos de Emergência

### Cenário 1: Site Fora do Ar (500/502/503)

```bash
# 1. Verificar se o serviço está rodando
docker service ps patricia-elias_frontend

# 2. Ver logs de erro
docker service logs patricia-elias_frontend --tail 100

# 3. Verificar se o container está saudável
docker ps -a | grep patricia-elias

# 4. Reiniciar o serviço
docker service update --force patricia-elias_frontend

# 5. Se não resolver, remover e recriar
docker stack rm patricia-elias
sleep 10
docker stack deploy -c docker-compose.yml patricia-elias
```

### Cenário 2: Deploy Quebrou a Aplicação

```bash
# 1. Ver histórico de commits
cd /opt/apps/revenda-patriciaelias
git log --oneline -10

# 2. Identificar último commit que funcionava
# Exemplo: 4a7f08e fix: instala devDependencies para build do Vite

# 3. Voltar para versão anterior
git checkout 4a7f08e

# 4. Rebuildar e fazer deploy
docker build --no-cache -t patricia-elias-reseller-app:latest .
docker service update --force patricia-elias_frontend

# 5. Quando resolver o problema, voltar para main
git checkout main
```

### Cenário 3: Imagem Docker Corrompida

```bash
# 1. Remover imagem atual
docker rmi patricia-elias-reseller-app:latest

# 2. Limpar cache do Docker
docker system prune -a -f

# 3. Rebuildar do zero
cd /opt/apps/revenda-patriciaelias
docker build --no-cache -t patricia-elias-reseller-app:latest .

# 4. Atualizar serviço
docker service update --force patricia-elias_frontend
```

### Cenário 4: Disco Cheio

```bash
# 1. Verificar espaço em disco
df -h

# 2. Ver uso do Docker
docker system df

# 3. Limpar containers parados
docker container prune -f

# 4. Limpar imagens não utilizadas
docker image prune -a -f

# 5. Limpar volumes não utilizados (CUIDADO!)
docker volume prune -f

# 6. Limpar tudo (MUITO CUIDADO!)
docker system prune -a --volumes -f
```

### Cenário 5: Variáveis de Ambiente Erradas

```bash
# 1. Verificar se .env.production existe
cd /opt/apps/revenda-patriciaelias
cat .env.production

# 2. Se estiver faltando ou errado, editar
nano .env.production

# 3. Rebuildar (variáveis são compiladas no build)
docker build --no-cache -t patricia-elias-reseller-app:latest .
docker service update --force patricia-elias_frontend
```

### Cenário 6: Certificado SSL Expirado

```bash
# 1. Verificar certificados do Traefik
docker service logs traefik | grep -i certificate

# 2. Forçar renovação (se usar Traefik)
docker service update --force traefik

# 3. Verificar se o domínio está apontando corretamente
nslookup revenda.pelg.com.br

# 4. Verificar logs do Traefik
docker service logs traefik --tail 200
```

### Cenário 7: Banco de Dados (Supabase) Fora

```bash
# 1. Verificar se é problema do Supabase
curl -I https://bpbklahbndoycbxehqwi.supabase.co

# 2. Ver logs da aplicação
docker service logs patricia-elias_frontend --tail 100 | grep -i supabase

# 3. Verificar status do Supabase
# Acesse: https://status.supabase.com/

# 4. Se for problema de conexão, verificar variáveis
cat /opt/apps/revenda-patriciaelias/.env.production | grep SUPABASE
```

### Cenário 8: Git Pull Falhou (Conflitos)

```bash
# 1. Ver status do git
git status

# 2. Se houver conflitos, descartar mudanças locais
git reset --hard HEAD

# 3. Tentar pull novamente
git pull

# 4. Se ainda falhar, forçar reset para origin
git fetch origin
git reset --hard origin/main
```

### Cenário 9: Rollback Completo

```bash
# 1. Parar a stack atual
docker stack rm patricia-elias

# 2. Voltar para versão estável conhecida
cd /opt/apps/revenda-patriciaelias
git checkout <hash-versao-estavel>

# 3. Rebuildar
docker build --no-cache -t patricia-elias-reseller-app:latest .

# 4. Deploy
docker stack deploy -c docker-compose.yml patricia-elias

# 5. Verificar logs
docker service logs patricia-elias_frontend -f
```

### Cenário 10: Memória/CPU Alta

```bash
# 1. Ver uso de recursos
docker stats

# 2. Identificar container problemático
docker ps

# 3. Reiniciar serviço específico
docker service update --force patricia-elias_frontend

# 4. Escalar para mais réplicas (se necessário)
docker service scale patricia-elias_frontend=2

# 5. Voltar para 1 réplica depois
docker service scale patricia-elias_frontend=1
```

---

## 🔴 Checklist de Emergência Rápida

Execute estes comandos em ordem quando algo der errado:

```bash
# 1. Status geral
docker stack ps patricia-elias
docker service ls

# 2. Logs recentes
docker service logs patricia-elias_frontend --tail 50

# 3. Reiniciar serviço
docker service update --force patricia-elias_frontend

# 4. Se não resolver, rollback
cd /opt/apps/revenda-patriciaelias
git log --oneline -5
git checkout <ultimo-commit-que-funcionava>
./deploy.sh

# 5. Monitorar
docker service logs patricia-elias_frontend -f
```

---

## 📞 Contatos de Emergência

- **Servidor**: Verificar com provedor de hospedagem
- **Supabase Status**: https://status.supabase.com/
- **GitHub Status**: https://www.githubstatus.com/

---

## 💾 Backup Antes de Mudanças Críticas

Antes de fazer mudanças grandes, faça backup:

```bash
# 1. Backup do código
cd /opt/apps
tar -czf revenda-patriciaelias-backup-$(date +%Y%m%d).tar.gz revenda-patriciaelias/

# 2. Backup da imagem Docker atual
docker save patricia-elias-reseller-app:latest | gzip > patricia-elias-backup-$(date +%Y%m%d).tar.gz

# 3. Restaurar backup se necessário
docker load < patricia-elias-backup-20260204.tar.gz
```
