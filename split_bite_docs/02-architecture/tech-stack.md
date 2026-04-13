# Tech Stack

## Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Expo | SDK 54 | React Native framework |
| Expo Router | v6 | File-based navigation |
| TypeScript | 5.9 | Type safety |
| TanStack Query | v5 | Server state management |
| React Native Reanimated | v4 | Animations |

## Backend
| Technology | Purpose |
|-----------|---------|
| Supabase Auth | Authentication (email/password) |
| Supabase PostgreSQL | Database with RLS |
| Supabase Realtime | Live order collaboration |
| Supabase Edge Functions | Order finalization, settlements |

## Testing
| Tool | Layer | Purpose |
|------|-------|---------|
| Jest + jest-expo | Unit | Test runner |
| RNTL | Component | React Native component tests |
| MSW | Integration | API mocking |
| pgTAP | Database | RLS + function tests |
| Maestro | E2E | Mobile UI automation |

## Dev Tools
| Tool | Purpose |
|------|---------|
| Supabase CLI | Local dev, migrations, type generation |
| EAS Build | Cloud builds for iOS/Android |
| GitHub Actions | CI pipeline |
