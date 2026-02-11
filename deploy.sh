#!/bin/bash

# Deploy script for Patricia Elias Reseller App
# GitHub: https://github.com/luiscortex/revenda-patriciaelias
# Server path: /opt/apps/revenda-patriciaelias

# Define stack and image names
STACK_NAME="patricia-elias"
IMAGE_NAME="patricia-elias-reseller-app"

echo "Deploying $STACK_NAME..."

# Atualizar código
echo "Updating code..."
git pull

# Rebuildar a aplicação
echo "Building Docker image..."
docker build --no-cache -t $IMAGE_NAME:latest .

# Deploy/atualizar stack
echo "Deploying stack..."
docker stack deploy -c docker-compose.yml $STACK_NAME

# Forçar atualização do serviço para usar nova imagem
echo "Forcing service update..."
docker service update --force ${STACK_NAME}_frontend

# WORKAROUND: Traefik perde router config - forçar redescoberta
echo "Waiting for service to be ready..."
sleep 10

echo "Forcing Traefik to rediscover services..."
docker service update --force traefik_traefik

echo "Waiting for Traefik to restart..."
sleep 30

echo "Deployment complete!"
echo "Access: https://revenda.pelg.com.br"
echo ""
echo "⚠️  If you get Gateway Timeout in browser:"
echo "   1. Close ALL browsers completely"
echo "   2. Open browser in incognito/private mode"
echo "   3. Access https://revenda.pelg.com.br"
