# Gel / EdgeDB – Cannot bind `listen_addresses = 0.0.0.0`

## Context

- Gel (EdgeDB) instance: `staffreview`
- Port: `10700`
- Goal: expose the database to LAN / remote access using:
  ```sql
  CONFIGURE INSTANCE SET listen_addresses := '0.0.0.0';
  ```

## Symptoms

When running:

```bash
gel configure set listen_addresses 0.0.0.0
```

You get:

```text
ConfigurationError: Server updated its config but cannot serve on requested address/port
```

Other observed issues:
- Client connections time out
- `gel -I staffreview` works intermittently
- `listen_addresses` always falls back to `127.0.0.1`

---

## Root Cause

**The Gel instance is started using systemd socket activation.**

Specifically:
- `edgedb-server@staffreview.socket` binds port `10700` first
- When the Gel service starts:
  - It cannot bind the port itself
  - It is forced to use the already-open socket
- As a result:
  - `listen_addresses` is ignored
  - Binding to `0.0.0.0` fails with **address already in use**

### Evidence from logs

```text
could not create listen socket for '0.0.0.0:10700':
address already in use
```

From `ss -lntp`:

```text
users:(("systemd",...), ("postgres",...), ("python3",...))
```

---

## Correct Fix (Clean & Permanent)

### 1. Fully disable socket activation

```bash
systemctl --user stop edgedb-server@staffreview.socket
systemctl --user disable edgedb-server@staffreview.socket
```

(Optional)
```bash
systemctl --user mask edgedb-server@staffreview.socket
```

> If `mask` reports that the file already exists, that is fine — the important thing is that the socket is not active.

---

### 2. Restart the service in standalone mode

```bash
systemctl --user stop edgedb-server@staffreview.service
systemctl --user start edgedb-server@staffreview.service
```

---

### 3. Set `listen_addresses`

```bash
gel configure set listen_addresses 0.0.0.0
```

Expected result:

```text
OK: CONFIGURE INSTANCE
```

---

### 4. Verify

```bash
ss -lntp | grep 10700
```

Correct output:

```text
LISTEN 0.0.0.0:10700 users:(("python3",pid=...,fd=...))
```

❌ No more:
- `systemd`
- `127.0.0.1`

---

## Key Takeaway

**systemd socket activation always overrides Gel `listen_addresses`.**

If you want full control over bind address/port:
- ❌ Do not use socket activation
- ✅ Run the Gel service in standalone mode

---

## Post-exposure Recommendations

1. **Set a strong admin password**
   ```sql
   ALTER ROLE admin SET password := 'STRONG_PASSWORD';
   ```

2. **Restrict access via firewall**
   - Allow only LAN / backend IPs
   - Never expose the database directly to the public Internet

3. **Remote clients**
   - Avoid `--trust-tls-cert` in production
   - Properly link instances and store certificates

---

## Final State (Healthy)

- ✅ Gel bound to `0.0.0.0`
- ✅ Stable remote connections
- ✅ No more timeouts or connection resets
- ✅ Production-ready configuration
