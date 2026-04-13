#!/bin/bash
# Create test users via Supabase Auth API after db reset
API="http://127.0.0.1:54321/auth/v1/signup"
KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

echo "Creating test users..."

curl -s -X POST "$API" \
  -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"bodz@test.com","password":"123123","data":{"display_name":"bodz"}}' > /dev/null

curl -s -X POST "$API" \
  -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@test.com","password":"123123","data":{"display_name":"Ahmed"}}' > /dev/null

echo "Done! Users: bodz@test.com / test2@test.com (password: 123123)"
