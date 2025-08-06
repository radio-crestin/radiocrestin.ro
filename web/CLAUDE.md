# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production bundle  
- `npm run lint` - Run Next.js linting
- `npm run generate` - Generate GraphQL types from schema

### Deployment
- `npm run preview` - Build and preview Cloudflare deployment locally
- `npm run deploy` - Build and deploy to Cloudflare Workers
- `npm run upload` - Build and upload to Cloudflare

## Architecture Overview

This is a Next.js 15.3 application using the App Router, deployed to Cloudflare Workers via OpenNextJS-Cloudflare.

### Key Technologies
- **Framework**: Next.js 15.3 with React 19.1.1
- **Deployment**: Cloudflare Workers
- **Styling**: SCSS modules
- **State Management**: Zustand stores (persisted and non-persisted)
- **API**: GraphQL with code generation
- **Audio Streaming**: HLS.js for radio streams
- **Error Tracking**: Bugsnag

### Data Flow
1. **Server-side**: `getStations()` fetches station data via GraphQL with ISR (30s revalidation)
2. **Client-side**: Data passed via props and shared through SelectedStationProvider context
3. **Audio Streaming**: Prioritizes HLS → Proxy → Direct streams with retry mechanism

### State Management Architecture
- **usePlayer**: Audio volume control (persisted)
- **useStation**: Current station and stations list
- **useFavourite**: User's favorite stations (persisted)
- **useStations**: Additional station state

### Component Organization
- All components in `src/common/components/` with styles.module.scss
- RadioPlayer handles multi-format streaming with fallback
- Stations component provides search/filter functionality
- Mobile responsive design throughout

### GraphQL Integration
- Endpoint from `NEXT_PUBLIC_GRAPHQL_ENDPOINT` env variable
- Types generated via `npm run generate`
- Main query: `GET_STATIONS_QUERY_STRING` in `src/common/graphql/queryStrings.ts`

## Project Guidelines

- Do not test the build unless explicitly specified
- When modifying the RadioPlayer component, preserve the multi-stream fallback logic
- Station pages use dynamic routing with `[station_slug]`
- All new components should be mobile responsive
- Use existing Zustand stores for state management rather than creating new ones