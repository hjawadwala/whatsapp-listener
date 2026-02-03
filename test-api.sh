#!/bin/bash

# WhatsApp API Test Script
# This script helps you test the message sending functionality

set -e

BASE_URL="${1:-http://localhost:3000}"
PHONE_NUMBER="${2:-919876543210}"

echo "🚀 WhatsApp API Test Suite"
echo "============================"
echo ""
echo "Base URL: $BASE_URL"
echo "Test Phone: $PHONE_NUMBER"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Create Session
echo -e "${BLUE}Test 1: Creating new session...${NC}"
SESSION_RESPONSE=$(curl -s -X POST $BASE_URL/api/sessions/create)
echo "$SESSION_RESPONSE" | jq '.' 2>/dev/null || echo "$SESSION_RESPONSE"

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId' 2>/dev/null || echo "")
TOKEN=$(echo $SESSION_RESPONSE | jq -r '.token' 2>/dev/null || echo "")

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create session${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Session created successfully${NC}"
echo "Session ID: $SESSION_ID"
echo "Token: $TOKEN"
echo ""

# Test 2: List Sessions
echo -e "${BLUE}Test 2: Listing sessions...${NC}"
SESSIONS_RESPONSE=$(curl -s -X GET $BASE_URL/api/sessions \
  -H "Authorization: Bearer $TOKEN")
echo "$SESSIONS_RESPONSE" | jq '.' 2>/dev/null || echo "$SESSIONS_RESPONSE"
echo -e "${GREEN}✅ Sessions listed${NC}"
echo ""

# Test 3: Send Text Message
echo -e "${BLUE}Test 3: Sending text message...${NC}"
TEXT_RESPONSE=$(curl -s -X POST $BASE_URL/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"to\": \"$PHONE_NUMBER\",
    \"message\": \"Test message from API at $(date)\"
  }")
echo "$TEXT_RESPONSE" | jq '.' 2>/dev/null || echo "$TEXT_RESPONSE"

if echo "$TEXT_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Text message sent${NC}"
else
  echo -e "${YELLOW}⚠️  Response received (check if session is connected)${NC}"
fi
echo ""

# Test 4: Invalid Token Test
echo -e "${BLUE}Test 4: Testing invalid token rejection...${NC}"
INVALID_TOKEN_RESPONSE=$(curl -s -X POST $BASE_URL/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token_here" \
  -d "{
    \"to\": \"$PHONE_NUMBER\",
    \"message\": \"This should fail\"
  }")
echo "$INVALID_TOKEN_RESPONSE" | jq '.' 2>/dev/null || echo "$INVALID_TOKEN_RESPONSE"

if echo "$INVALID_TOKEN_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Invalid token correctly rejected${NC}"
else
  echo -e "${RED}❌ Invalid token should have been rejected${NC}"
fi
echo ""

# Test 5: Missing Fields Test
echo -e "${BLUE}Test 5: Testing missing fields validation...${NC}"
MISSING_FIELDS_RESPONSE=$(curl -s -X POST $BASE_URL/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"to\": \"$PHONE_NUMBER\"
  }")
echo "$MISSING_FIELDS_RESPONSE" | jq '.' 2>/dev/null || echo "$MISSING_FIELDS_RESPONSE"

if echo "$MISSING_FIELDS_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Missing fields correctly rejected${NC}"
else
  echo -e "${RED}❌ Missing fields should have been rejected${NC}"
fi
echo ""

# Test 6: Check Audit Log
echo -e "${BLUE}Test 6: Checking audit logs...${NC}"
if [ -f "data/sent-messages.log" ]; then
  echo "Recent audit log entries:"
  tail -3 data/sent-messages.log | jq '.' 2>/dev/null || tail -3 data/sent-messages.log
  echo -e "${GREEN}✅ Audit log exists${NC}"
else
  echo -e "${YELLOW}⚠️  Audit log not created yet (messages may not have been sent)${NC}"
fi
echo ""

# Test 7: Session Info
echo -e "${BLUE}Test 7: Getting full session info...${NC}"
SESSION_INFO=$(curl -s -X GET $BASE_URL/api/sessions \
  -H "Authorization: Bearer $TOKEN")
echo "$SESSION_INFO" | jq '.' 2>/dev/null || echo "$SESSION_INFO"
echo ""

echo -e "${GREEN}============================"
echo "✅ Test suite completed!"
echo "============================${NC}"
echo ""
echo "Summary:"
echo "  - Session ID: $SESSION_ID"
echo "  - Token: ${TOKEN:0:20}...${TOKEN: -20}"
echo "  - Commands to try:"
echo ""
echo "  Send text:"
echo "    curl -X POST $BASE_URL/api/messages/text \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -H 'Authorization: Bearer $TOKEN' \\"
echo "      -d '{\"to\": \"$PHONE_NUMBER\", \"message\": \"Hello\"}'"
echo ""
echo "  View logs:"
echo "    tail -f data/sent-messages.log"
echo ""
echo "  Delete session:"
echo "    curl -X DELETE $BASE_URL/api/sessions/$SESSION_ID \\"
echo "      -H 'Authorization: Bearer $TOKEN'"
echo ""
