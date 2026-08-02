# Password manager API & CLI

DoneBun stores passwords in a Convex `passwords` table. In the app, open **Settings → Passwords** to manage your own entries.

For automation, use the HTTP API on your Convex site URL (`VITE_CONVEX_SITE_URL` / `*.convex.site`). Authenticate as the DoneBun user whose vault you want — there is no global master key. Passwords are stored as plaintext — this is a convenience vault, not a hardened secrets product.

## Auth

Every API request uses **HTTP Basic Auth** with that user’s DoneBun **email** and **account password** (the same credentials used to sign in to the app).

```http
Authorization: Basic base64(email:password)
Content-Type: application/json
```

You only see and modify passwords owned by that user.

Base URL examples:

| Environment | Base URL |
| :--- | :--- |
| Local | `http://127.0.0.1:3211` |
| Cloud | `https://<deployment>.convex.site` |

Sign in to the app at least once after creating an account so the DoneBun user profile exists; otherwise the API returns `403`.

## API

### List passwords for the authenticated user

```bash
curl -sS "$SITE/api/passwords" \
  -u "$DONEBUN_EMAIL:$DONEBUN_PASSWORD"
```

Response:

```json
{
  "passwords": [
    {
      "_id": "…",
      "name": "GitHub",
      "username": "you@example.com",
      "password": "secret",
      "url": "https://github.com",
      "notes": "optional",
      "ownerId": "…",
      "updatedAt": 1710000000000
    }
  ]
}
```

### Get one password

```bash
curl -sS "$SITE/api/passwords/<id>" \
  -u "$DONEBUN_EMAIL:$DONEBUN_PASSWORD"
```

Returns `404` if the id does not exist or belongs to another user.

### Create a password

```bash
curl -sS -X POST "$SITE/api/passwords" \
  -u "$DONEBUN_EMAIL:$DONEBUN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub",
    "username": "you@example.com",
    "password": "secret",
    "url": "https://github.com",
    "notes": "2FA on phone"
  }'
```

| Field | Required | Notes |
| :--- | :--- | :--- |
| `name` | yes | Display label |
| `password` | yes | Secret value stored in the vault |
| `username` | no | Login username for the entry |
| `url` | no | |
| `notes` | no | |

The entry is always owned by the authenticated user.

### Update a password

```bash
curl -sS -X PATCH "$SITE/api/passwords/<id>" \
  -u "$DONEBUN_EMAIL:$DONEBUN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"password": "new-secret", "notes": "rotated"}'
```

Send only the fields you want to change.

### Delete a password

```bash
curl -sS -X DELETE "$SITE/api/passwords/<id>" \
  -u "$DONEBUN_EMAIL:$DONEBUN_PASSWORD"
```

## CLI helper

A thin wrapper lives at `scripts/passwords-cli.sh`:

```bash
export DONEBUN_SITE_URL="https://<deployment>.convex.site"
export DONEBUN_EMAIL="you@example.com"
export DONEBUN_PASSWORD="your-donebun-password"

./scripts/passwords-cli.sh list
./scripts/passwords-cli.sh get <id>
./scripts/passwords-cli.sh create --name GitHub --password secret --username you@example.com
./scripts/passwords-cli.sh update <id> --password new-secret
./scripts/passwords-cli.sh delete <id>
```

`DONEBUN_USERNAME` is accepted as an alias for `DONEBUN_EMAIL`.  
`jq` is optional; if installed, list/get output is pretty-printed.

## In-app access

Signed-in users manage **their own** passwords via Convex mutations (`passwords.list` / `create` / `update` / `remove`). The HTTP/CLI path uses the same ownership model: authenticate as user A → only user A’s vault.
