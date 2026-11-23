#!/usr/bin/env bash
# Prepara um banco vazio para o test-receiving.sh: cria admin e motorista de teste e importa a NF de exemplo.
# Uso (na raiz do projeto, com o servidor rodando):  bash src/__tests__/setup-test-data.sh
B=${B:-http://localhost:3001/api/v1}
ADMIN_EMAIL=${ADMIN_EMAIL:-roni@teste.com};  ADMIN_PASS=${ADMIN_PASS:-senha1234}
MOTO_EMAIL=${MOTO_EMAIL:-joao@example.com};  MOTO_PASS=${MOTO_PASS:-senhaSegura123}
XML=${XML:-src/__tests__/fixtures/nfe-exemplo.xml}

register() {  # nome email senha papel
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/users/register" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$1\",\"email\":\"$2\",\"password\":\"$3\",\"role\":\"$4\"}")
  case "$code" in
    201) echo "✅ $2 criado ($4)" ;;
    409) echo "ℹ️  $2 já existia" ;;
    *)   echo "❌ cadastro de $2 → HTTP $code (servidor no ar? o banco é o certo?)"; exit 1 ;;
  esac
}

register "Roni Teste" "$ADMIN_EMAIL" "$ADMIN_PASS" recebedor
register "Joao Silva" "$MOTO_EMAIL"  "$MOTO_PASS"  motorista

echo "--- promovendo $ADMIN_EMAIL a admin"
npx tsx src/scripts/set-role.ts "$ADMIN_EMAIL" admin || { echo "❌ não consegui promover (veja o erro acima)"; exit 1; }

echo "--- login do admin"
TOKEN=$(curl -s -X POST "$B/users/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | jq -r '.data.token // empty')
[ -z "$TOKEN" ] && { echo "❌ login falhou"; exit 1; }
echo "✅ token obtido"

echo "--- importando a NF de exemplo"
[ -f "$XML" ] || { echo "❌ XML não encontrado em $XML (rode da raiz do projeto)"; exit 1; }
RESP=$(curl -s -X POST "$B/invoices/xml" -H "Authorization: Bearer $TOKEN" -F "xml=@$XML")
echo "$RESP" | jq -r '.message // .'
echo "   itens: $(echo "$RESP" | jq -r '.data.invoice.itens | length // "?"')  valor: $(echo "$RESP" | jq -r '.data.invoice.valorTotal // "?"')"

echo; echo "Pronto. Agora: bash src/__tests__/test-receiving.sh"
