# CLAUDE.md

Conventions for the backend (`backend/` of the radiocrestin.ro monorepo). Open it before changing the API,
the admin, the streaming service or a deploy. Setup and layout for people: [README.md](README.md).

## Project Overview

Radio Crestin Backend is a **Christian Radio Stations Directory** system providing:
- Radio station management and streaming
- HLS (HTTP Live Streaming) conversion service  
- Real-time metadata scraping from radio stations
- GraphQL API (Strawberry Django)
- Admin portal for station management
- Analytics and listener tracking

## Tech Stack

**Backend:** Django 5.1 with SuperApp architecture, PostgreSQL (TimescaleDB), Redis, Celery
**API:** Strawberry Django GraphQL
**Frontend:** Django Admin with django-unfold theme, TailwindCSS + Flowbite, Alpine.js
**Streaming:** FFmpeg + NGINX live HLS (`streaming/`), one pod per station, managed by a stream controller
**Infrastructure:** Docker, Kubernetes, S3-compatible storage

## Development Setup

```bash
# Quick setup, from backend/
cp .env.example .env
make start-docker
make migrate
make createsuperuser        # then open http://localhost:8080/portal/
```

## Essential Commands

### Docker Operations
```bash
make start-docker              # Start all services
make force-start-docker        # Force recreate containers
make stop-docker              # Stop all services
make destroy-docker           # Stop and remove volumes
make web-bash                 # Access Django container
make web-logs                 # View Django logs
make stream-controller-logs   # View the stream controller's logs
make live-streaming-logs      # View the local live-stream pod's logs
```

### Database Operations
```bash
make makemigrations           # Create new migrations
make migrate                  # Apply migrations
make createsuperuser          # Create admin user
make sync-prod-db-clean       # Sync production data locally (CAUTION)
```

### Development Tools
```bash
make start-tailwind-watch     # Watch TailwindCSS changes for admin
make run-all-scrapers         # Test metadata scraping functionality
make collectstatic            # Collect static files
```

### Testing and Quality
```bash
# What CI runs (.github/workflows/ci.yml); no services needed, Django falls back to SQLite
cd api && SECRET_KEY=dev python manage.py check && SECRET_KEY=dev python -m pytest -q tests
cd streaming && python -m pytest -q tests --ignore=tests/test_hls_stream.py --ignore=tests/test_segment_serving.py
# The two ignored files test a running stream: make dev-stream-test (from backend/)
```

## Architecture

### Django SuperApp Structure
```
api/superapp/apps/
├── radio_crestin/           # Core models (stations, artists, songs)
├── radio_crestin_scraping/  # Metadata scraping system
├── admin_portal/            # Enhanced admin interface
├── authentication/         # User management with django-allauth
├── graphql/                # GraphQL schema & resolvers
├── tasks/                  # Celery background tasks
└── backups/                # Database backup functionality
```

### Key Services
- **Django Backend** (port 8080): Main application server + GraphQL API
- **PostgreSQL** (port 5432): TimescaleDB database
- **Redis** (port 6379): Caching and Celery message broker
- **Stream controller**: starts one live-streaming pod per station (`streaming/controller.py`)
- **Live streaming** (port 8085): FFmpeg + NGINX serving a station as HLS (`streaming/live_streaming/`)

## Coding Conventions

### Folders
- `api/`: the Django project (`superapp/apps/*`); its Docker build context
- `streaming/`: stream controller, live-streaming image, station listing; with unit tests in `streaming/tests`
- `station-thumbnails/`: original station artwork

### File Organization (paths inside `api/`)
- **Admins**: `superapp/apps/<app_name>/admin/<model_name_slug>.py`
- **Models**: `superapp/apps/<app_name>/models/<model_name_slug>.py`  
- **Services**: `superapp/apps/<app_name>/services/<service_name>.py`
- **Tasks**: `superapp/apps/<app_name>/tasks/<task_name>.py`
- **Views**: `superapp/apps/<app_name>/views/<view_name>.py`
- **Signals**: `superapp/apps/<app_name>/signals/<model_name_slug>.py`

### Django Guidelines
- Follow PEP 8 compliance and Django best practices
- Use Django ORM, avoid raw SQL queries
- Use `django-unfold` with `SuperAppModelAdmin` for admin
- Register with `superapp_admin_site` from `superapp.apps.admin_portal.sites`
- Prefer `autocomplete_fields` for ForeignKey/ManyToMany relationships
- All user-facing strings must use Django i18n: `_('Text')`

### Services Pattern
- Keep services with just two operations: `upsert` and `delete`
- All database interactions should go through services layer
- Services handle business logic, views handle request/response

### Admin Integration
```python
# Example admin registration
from superapp.apps.admin_portal.admin import SuperAppModelAdmin
from superapp.apps.admin_portal.sites import superapp_admin_site

@admin.register(MyModel, site=superapp_admin_site)
class MyModelAdmin(SuperAppModelAdmin):
    list_display = ['slug', 'name', 'created_at']
    search_fields = ['name', 'slug']
    autocomplete_fields = ['related_field']
```

### SuperApp Configuration
Each app configures itself in `settings.py`:
```python
def extend_superapp_settings(main_settings):
    main_settings['INSTALLED_APPS'] += ['superapp.apps.my_app']
    # Add navigation, middleware, etc.
```

## Environment Configuration

- **`.env`**: Main environment configuration
- **`api/.env.local`**: Local overrides when running Django outside Docker (from `api/.env.local.example`)

## Testing Patterns

Test scraping functionality:
```bash
make run-all-scrapers
```

## Deployment

Production deploys from the private `bringes-infrastructure` repo (env `radio_crestin_production`, Fleet on
`prod-rke2`): build, CVE gate, tag bump, reconcile. Steps, and how to allow a new station's hosts through the
egress proxy: [README.md#-deploying](README.md#-deploying).

- **Namespace**: `radio-crestin-production`
- **Kubeconfig**: `bringes-infrastructure/environments/bringes_production/secrets/clusters/prod-rke2/kubeconfig.yaml`
- **Streamer pods** are managed by the stream controller (not Helm). To force env var updates, delete them
  (`kubectl delete deployments -n radio-crestin-production -l app=live-stream`); the controller recreates
  them within 60 seconds.

## Mobile Responsiveness

All frontend components should be mobile responsive using TailwindCSS classes and responsive design patterns.

## Important Notes

- **Commit frequently**: Make granular commits after each task completion
- **Services pattern**: Use only upsert/delete operations in services
- **SuperApp structure**: Follow the modular app architecture
- **Mobile first**: Ensure all UI components are responsive
- **i18n support**: Use Django translation for all user-facing text
- **Security**: Never commit secrets; use environment variables
