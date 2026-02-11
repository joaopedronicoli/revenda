#!/bin/bash

# Deploy script for Docker Swarm - Revenda Patricia Elias
# Usage: ./deploy-swarm.sh
# GitHub: https://github.com/joaopedronicoli/revenda

set -e

STACK_NAME="patricia-elias"
BACKEND_IMAGE="patricia-elias-backend"
FRONTEND_IMAGE="patricia-elias-reseller-app"

echo "🚀 Deploy Script - Revenda Patricia Elias"
echo "==========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "Crie um arquivo .env com as variáveis necessárias (DB_HOST, JWT_SECRET, etc.)"
    exit 1
fi

# Load .env and export all variables
echo "📦 Carregando variáveis do .env..."
set -a
source .env
set +a

# Verify critical variables
MISSING=0
for VAR in JWT_SECRET DB_HOST DB_USER DB_PASS DB_NAME; do
    if [ -z "${!VAR}" ]; then
        echo "⚠️  WARNING: $VAR não está definido no .env!"
        MISSING=1
    fi
done

if [ "$MISSING" -eq 1 ]; then
    echo ""
    read -p "Continuar mesmo assim? (y/N): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Deploy cancelado."
        exit 1
    fi
fi

echo "✅ Variáveis carregadas"
echo ""

# Pull latest code
echo "📥 Atualizando código..."
git pull

# Build backend
echo ""
echo "🔨 Building backend ($BACKEND_IMAGE)..."
docker build --no-cache -t $BACKEND_IMAGE:latest ./server

# Build frontend
echo ""
echo "🔨 Building frontend ($FRONTEND_IMAGE)..."
docker build --no-cache -t $FRONTEND_IMAGE:latest .

# Deploy stack
echo ""
echo "🐳 Fazendo deploy da stack $STACK_NAME..."
docker stack deploy -c docker-compose.yml $STACK_NAME

# Force service updates to use new images
echo ""
echo "🔄 Forçando atualização dos serviços..."
docker service update --force ${STACK_NAME}_backend
docker service update --force ${STACK_NAME}_frontend

echo ""
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# Force Traefik rediscovery
echo "🔄 Forçando Traefik a redescobrir serviços..."
docker service update --force traefik_traefik

echo ""
echo "⏳ Aguardando Traefik reiniciar..."
sleep 15

# Show status
echo ""
echo "📊 Status dos serviços:"
docker service ls | grep $STACK_NAME

echo ""
echo "✅ Deploy concluído!"
echo "🌐 Acesse: https://revenda.pelg.com.br"
echo ""
echo "📝 Para ver logs:"
echo "   Backend:  docker service logs ${STACK_NAME}_backend --tail=50 -f"
echo "   Frontend: docker service logs ${STACK_NAME}_frontend --tail=50 -f"
echo ""
echo "🗄️  Para inicializar o banco (primeira vez):"
echo "   docker exec \$(docker ps -q -f name=${STACK_NAME}_backend) node setup_db.js"
