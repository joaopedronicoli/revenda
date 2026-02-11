# Deploy no Servidor - Comandos

**GitHub**: https://github.com/luiscortex/revenda-patriciaelias  
**Servidor**: `/opt/apps/revenda-patriciaelias`

Você já clonou o repositório! Agora execute os comandos abaixo no servidor:

## 1. Atualizar Código e Buildar Imagem

```bash
cd /opt/apps/revenda-patriciaelias
git pull
docker build --no-cache -t patricia-elias-reseller-app:latest .
```

## 2. Deploy da Stack

```bash
docker stack deploy -c docker-compose.yml patricia-elias
```

## 3. Verificar Status

```bash
# Ver serviços rodando
docker stack ps patricia-elias

# Ver logs
docker service logs patricia-elias_frontend -f
```

## 4. Verificar Acesso

Acesse: **https://revenda.pelg.com.br**

O Traefik vai gerar o certificado SSL automaticamente.

---

## Para Futuras Atualizações

Use o script `deploy.sh`:

```bash
cd /opt/apps/revenda-patriciaelias
./deploy.sh
```

Ou manualmente:
```bash
git pull
docker build --no-cache -t patricia-elias-reseller-app:latest .
docker stack deploy -c docker-compose.yml patricia-elias
```

## Troubleshooting

Se der erro de permissão no `deploy.sh`:
```bash
chmod +x deploy.sh
```

Se precisar remover a stack:
```bash
docker stack rm patricia-elias
```
