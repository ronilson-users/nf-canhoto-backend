#!/usr/bin/env bash
# Teste ponta a ponta: conferência + perecíveis (FT-19) + evidências + devolução parcial.
# Uso:  bash test-receiving.sh
# Pré-requisitos: servidor rodando, jq e sha256sum instalados, nota 3526...1813 já importada pelo XML.
B=${B:-http://localhost:3001/api/v1}
CH=${CH:-35261011906445000151550010008832041101671813}
ADMIN_EMAIL=${ADMIN_EMAIL:-roni@teste.com};  ADMIN_PASS=${ADMIN_PASS:-senha1234}
MOTO_EMAIL=${MOTO_EMAIL:-joao@example.com};  MOTO_PASS=${MOTO_PASS:-senhaSegura123}
# NFs de devolução de teste (chaves válidas): emitida pelo comprador / emitente sem relação / DV errado
NF_OK=35261007247975000168550010000001231123456782
NF_ALHEIO=35261011222333000181550010000004561123456780
NF_DV_RUIM=35261007247975000168550010000001231123456783
T=${TMPDIR:-.}
FAIL=0

login() {
  curl -s -X POST "$B/users/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.data.token // empty'
}

# req METHOD CAMINHO TOKEN [JSON]  ->  CODE e BODY
req() {
  local out
  if [ -n "${4:-}" ]; then
    out=$(curl -s -w '\n%{http_code}' -X "$1" "$B$2" -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$4")
  else
    out=$(curl -s -w '\n%{http_code}' -X "$1" "$B$2" -H "Authorization: Bearer $3")
  fi
  CODE=${out##*$'\n'}; BODY=${out%$'\n'*}
}

# upload TOKEN CAMINHO ARQUIVO [-F campo=valor ...]  ->  CODE e BODY
upload() {
  local t=$1 p=$2 f=$3 out; shift 3
  out=$(curl -s -w '\n%{http_code}' -X POST "$B$p" -H "Authorization: Bearer $t" -F "file=@$f" "$@")
  CODE=${out##*$'\n'}; BODY=${out%$'\n'*}
}

check() {  # descrição  código_esperado
  if [ "$CODE" = "$2" ]; then echo "✅ $1 → $CODE"
  else echo "❌ $1 → $CODE (esperado $2)"; echo "$BODY" | jq . 2>/dev/null || echo "$BODY"; FAIL=1; fi
}
expect() {  # descrição  filtro_jq  valor_esperado
  local got; got=$(echo "$BODY" | jq -r "$2")
  if [ "$got" = "$3" ]; then echo "   ✔ $1 = $got"
  else echo "   ✘ $1 = $got (esperado $3)"; FAIL=1; fi
}

ADMIN=$(login "$ADMIN_EMAIL" "$ADMIN_PASS"); MOTO=$(login "$MOTO_EMAIL" "$MOTO_PASS")
[ -z "$ADMIN" ] && { echo "❌ login do admin falhou (servidor no ar? senha?)"; exit 1; }
[ -z "$MOTO" ]  && echo "⚠️  login do motorista falhou: pulando o teste de 403"

# arquivos de teste
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > "$T/pixel.png"
echo 'isso nao e uma imagem de verdade' > "$T/fake.jpg"
SHA_PNG=$(sha256sum "$T/pixel.png" | cut -d' ' -f1)

R="/invoices/$CH/receiving"
echo "--- preparação"
req DELETE "$R?force=true" "$ADMIN"; echo "   (reset forçado: $CODE — 404 é normal se não havia conferência)"

echo "--- permissões e início"
[ -n "$MOTO" ] && { req POST "$R" "$MOTO"; check "motorista tenta iniciar" 403; }
req POST "$R" "$ADMIN";  check "admin inicia a conferência" 201
req POST "$R" "$ADMIN";  check "iniciar de novo" 409

echo "--- validação"
req PUT "$R/items/1" "$ADMIN" '{}';                                                                  check "item sem quantidade" 400
req PUT "$R/items/1" "$ADMIN" '{"quantidadeRecebida":5,"quantidadeAvariada":9}';                     check "avariada > recebida" 400
req PUT "$R/items/99" "$ADMIN" '{"quantidadeRecebida":1}';                                           check "item inexistente" 404
req PUT "$R/items/1" "$ADMIN" '{"quantidadeRecebida":3.5,"perecivel":{"categoria":"congelado"}}';    check "congelado sem temperatura/condições" 400
req PUT "$R/items/1" "$ADMIN" '{"quantidadeRecebida":3.5,"perecivel":{"categoria":"resfriado","temperaturaC":5,"condicoes":{"rotulo":"C","produto":"C","transporte":"C","entregador":"C"}}}'
check "resfriado sem subcategoria" 400

C='"condicoes":{"rotulo":"C","produto":"C","transporte":"C","entregador":"C"}'

echo "--- conferência item a item (com FT-19)"
req PUT "$R/items/1" "$ADMIN" "{\"quantidadeRecebida\":3.45,\"perecivel\":{\"categoria\":\"congelado\",\"temperaturaC\":-15,\"lote\":\"209\",\"sif\":\"673\",\"validade\":\"2027-09-20\",$C}}"
check "item 1 (barriga 3,45 kg, congelada a -15 °C)" 200
expect "tipo" '.data.itens[0].tipo' ok
expect "FT-19" '.data.itens[0].perecivel.conformidade' conforme

req PUT "$R/items/2" "$ADMIN" "{\"quantidadeRecebida\":4.8,\"perecivel\":{\"categoria\":\"congelado\",\"temperaturaC\":-8,\"lote\":\"2862\",$C}}"
check "item 2 a -8 °C sem ressalva (deve barrar)" 422
req PUT "$R/items/2" "$ADMIN" "{\"quantidadeRecebida\":4.8,\"perecivel\":{\"categoria\":\"congelado\",\"temperaturaC\":-8,\"lote\":\"2862\",\"ressalva\":\"RT autorizou uso imediato\",$C}}"
check "item 2 a -8 °C com ressalva" 200
expect "tipo" '.data.itens[1].tipo' sobra
expect "FT-19" '.data.itens[1].perecivel.conformidade' nao_conforme

req PUT "$R/items/3" "$ADMIN" '{"quantidadeRecebida":5,"perecivel":{"categoria":"seco","lote":"L55","validade":"2027-05-01"}}'
check "item 3 (ervilha, seca, 5 de 6)" 200;  expect "abater (centavos)" '.data.itens[2].valorAbaterCentavos' 1751

req PUT "$R/items/4" "$ADMIN" '{"quantidadeRecebida":6,"quantidadeAvariada":1,"motivo":"lata amassada"}'
check "item 4 (milho, 1 avariada)" 200;  expect "abater (centavos)" '.data.itens[3].valorAbaterCentavos' 2350
expect "quantidadeDevolver" '.data.itens[3].quantidadeDevolver' 1

echo "--- finalizar com item pendente"
req POST "$R/finish" "$ADMIN" '{}';  check "finish com item 5 pendente" 422

echo "--- item 5: queijo a 12 °C (limite 10 °C) é recusado"
req PUT "$R/items/5" "$ADMIN" "{\"recusado\":true,\"perecivel\":{\"categoria\":\"resfriado\",\"subcategoria\":\"outros\",\"temperaturaC\":12,$C}}"
check "item 5 recusado" 200
expect "tipo" '.data.itens[4].tipo' recusa
expect "quantidadeDevolver" '.data.itens[4].quantidadeDevolver' 2
expect "motivo automático" '.data.itens[4].motivo | contains("acima do limite")' true

echo "--- evidências"
upload "$ADMIN" "/invoices/$CH/evidence" "$T/pixel.png" -F tipo=foto -F alvo=item -F numeroItem=5 -F legenda="queijo 12 graus"
check "foto do item 5" 201
expect "sha256 do envio" '.data.arquivo.sha256' "$SHA_PNG"
expect "sem caminho interno" '.data.arquivo.storageKey // "oculto"' oculto
upload "$ADMIN" "/invoices/$CH/evidence" "$T/fake.jpg" -F tipo=foto;                       check "texto com extensão .jpg" 400
upload "$ADMIN" "/invoices/$CH/evidence" "$T/pixel.png" -F tipo=foto -F alvo=item;         check "alvo item sem numeroItem" 400
upload "$ADMIN" "/invoices/$CH/evidence" "$T/pixel.png" -F tipo=assinatura;                check "assinatura sem nome/papel" 400
upload "$ADMIN" "/invoices/$CH/evidence" "$T/pixel.png" -F tipo=foto -F alvo=devolucao;    check "devolução ainda não existe" 422
upload "$ADMIN" "/invoices/$CH/evidence" "$T/pixel.png" -F tipo=assinatura -F alvo=nota -F papel=recebedor -F nome="Roni Recebedor"
check "assinatura do recebedor" 201
ASSIN_RECEB=$(echo "$BODY" | jq -r '.data._id')
req GET "/invoices/$CH/evidence" "$ADMIN";  check "listar evidências" 200
expect "pelo menos 2 (evidências de execuções anteriores permanecem)" '(.data | length) >= 2' true
EV1=$(echo "$BODY" | jq -r '.data[0]._id')
curl -s -o "$T/baixado.png" -w '' -H "Authorization: Bearer $ADMIN" "$B/invoices/$CH/evidence/$EV1/file"
[ "$(sha256sum "$T/baixado.png" | cut -d' ' -f1)" = "$SHA_PNG" ] \
  && echo "✅ download confere com o SHA-256 enviado" || { echo "❌ download diferente do enviado"; FAIL=1; }

echo "--- finalizar: devolução parcial"
req POST "$R/finish" "$ADMIN" '{"volumesRecebidos":21,"observacao":"faltou 1 volume"}'
check "finish" 200
expect "resultado" '.data.resultado' recebida_parcial
expect "valor a abater (centavos)" '.data.resumo.valorAbaterCentavos' 11491
expect "valor líquido (centavos)" '.data.resumo.valorLiquidoCentavos' 34955
expect "volumes divergentes" '.data.volumesDivergentes' true
req GET "/invoices/$CH" "$ADMIN";  expect "status da nota" '.data.status' recebida_parcial

echo "--- devolução"
RET="/invoices/$CH/return"
req GET "$RET" "$ADMIN";  check "devolução gerada" 200
expect "itens devolvidos" '.data.itens | length' 2
expect "total (centavos)" '.data.totalCentavos' 9740
expect "status" '.data.status' pendente_coleta
req POST "$RET/collect" "$ADMIN" '{"motoristaNome":"Diego de Oliveira"}';   check "coleta sem assinatura" 400
req POST "$RET/collect" "$ADMIN" "{\"motoristaNome\":\"Diego de Oliveira\",\"assinaturaId\":\"$ASSIN_RECEB\"}"
check "coleta com assinatura do RECEBEDOR (inválida)" 422
upload "$ADMIN" "/invoices/$CH/evidence" "$T/pixel.png" -F tipo=assinatura -F alvo=devolucao -F papel=motorista -F nome="Diego de Oliveira"
check "assinatura do motorista (alvo devolução)" 201
ASSIN_MOTO=$(echo "$BODY" | jq -r '.data._id')
req POST "$RET/collect" "$ADMIN" "{\"motoristaNome\":\"Diego de Oliveira\",\"placa\":\"FEF2G31\",\"assinaturaId\":\"$ASSIN_MOTO\"}"
check "coleta" 200;  expect "status" '.data.status' coletada
req POST "$RET/collect" "$ADMIN" "{\"motoristaNome\":\"Diego de Oliveira\",\"assinaturaId\":\"$ASSIN_MOTO\"}"
check "coletar de novo" 409
req POST "$RET/nf" "$ADMIN" "{\"chaveNfDevolucao\":\"$NF_DV_RUIM\"}";   check "NF de devolução com DV errado" 400
req POST "$RET/nf" "$ADMIN" "{\"chaveNfDevolucao\":\"$NF_ALHEIO\"}";    check "NF de devolução de emitente alheio" 422
req POST "$RET/nf" "$ADMIN" "{\"chaveNfDevolucao\":\"$CH\"}";           check "NF de devolução = nota original" 422
req POST "$RET/nf" "$ADMIN" "{\"chaveNfDevolucao\":\"$NF_OK\"}"
check "NF de devolução válida" 200;  expect "chave gravada" '.data.nfDevolucaoChave' "$NF_OK"

echo "--- depois de finalizada"
req PUT "$R/items/1" "$ADMIN" '{"quantidadeRecebida":3.5}';  check "editar após finalizar" 409
req DELETE "$R" "$ADMIN";                                    check "reset comum com devolução coletada" 409

echo "--- trilha de eventos"
req GET "/invoices/$CH/events" "$ADMIN";  check "eventos" 200
expect "cadeia de hashes íntegra" '.data.integridadeOk' true
echo "   tipos: $(echo "$BODY" | jq -r '[.data.events[].type] | join(", ")')"
echo "   ↳ confira: nenhum evento contém o nome do motorista:"
echo "$BODY" | jq -e '[.data.events[].payload | tostring | contains("Diego")] | any | not' >/dev/null \
  && echo "   ✔ sem dados pessoais na trilha" || { echo "   ✘ nome do motorista apareceu na trilha"; FAIL=1; }

echo "--- sugestão de categoria aprendida"
req DELETE "$R?force=true" "$ADMIN";  check "reset forçado" 200
req POST "$R" "$ADMIN";               check "nova conferência" 201
expect "item 1 sugerido" '.data.itens[0].categoriaSugerida' congelado
expect "item 5 sugerido" '.data.itens[4].subcategoriaSugerida' outros
req DELETE "$R?force=true" "$ADMIN";  check "limpeza" 200

echo; [ "$FAIL" = 0 ] && echo "🎉 tudo certo" || { echo "⚠️  houve falhas acima"; exit 1; }
