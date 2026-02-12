#!/bin/bash

# SolForge API Test Script
# Tests all major endpoints

BASE_URL="http://localhost:3000"
WALLET="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"

echo "🚀 Testing SolForge API Endpoints"
echo "================================="

echo "📡 Health Check..."
curl -s "$BASE_URL/health" | jq .

echo -e "\n📋 Protocols..."
curl -s "$BASE_URL/api/protocols" | jq '.protocols[] | {name, description}'

echo -e "\n💡 Examples..."
curl -s "$BASE_URL/api/examples" | jq '.examples'

echo -e "\n💸 SOL Transfer (Natural Language)..."
curl -s -X POST "$BASE_URL/api/build/natural" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"transfer 0.01 SOL to $WALLET\",
    \"payer\": \"$WALLET\"
  }" | jq '.details'

echo -e "\n📝 Memo (Natural Language)..."
curl -s -X POST "$BASE_URL/api/build/natural" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"memo \\\"Hello SolForge!\\\"\",
    \"payer\": \"$WALLET\"
  }" | jq '.details'

echo -e "\n💎 Jito Tip (Structured)..."
curl -s -X POST "$BASE_URL/api/build" \
  -H "Content-Type: application/json" \
  -d "{
    \"intent\": \"tip\",
    \"params\": {\"amount\": 0.001},
    \"payer\": \"$WALLET\"
  }" | jq '.details'

echo -e "\n✨ Test Complete!"