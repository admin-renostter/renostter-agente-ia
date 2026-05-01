# Waha Core - WhatsApp API (GOWS engine)
# FROM devlikeapro/waha:latest (for Core - text only)
FROM devlikeapro/waha:latest

# Expose default Waha port
EXPOSE 8080

# No special config needed - Waha Core uses GOWS, no browser required
# Sessions are managed via REST API: /api/sessions/:session/start

# Health check (optional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:8080/ping || exit 1
