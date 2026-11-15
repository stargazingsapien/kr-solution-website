# KR Solution — complete website handoff

This folder contains the working storefront, password-protected admin panel, current catalogue, uploaded images, local photos, design references and tests. There is no payment integration. No external database or npm dependency installation is required.

## Quick local preview

1. Install Node.js 24 or newer.
2. Extract the ZIP and open the `KR-Solution-Website` folder.
3. Run `npm start` (on Windows you can also double-click `START-WINDOWS.cmd`).
4. Website: http://127.0.0.1:8098/
5. Admin: http://127.0.0.1:8098/admin

Keep the server running while reviewing the website. Opening index.html directly will not run the catalogue or admin features.

## Admin sign-in

Username: **admin**. This package preserves the current admin password by carrying its hashed credential in `private/admin.json`. Get the existing password from the person who sent you the ZIP. Plaintext passwords are deliberately not included in this document. Change it in Admin → Account when handing control to the client.

## Host on a temporary domain

Use a Node.js web-service host or a VPS/container with a persistent writable disk. This is a server application; static-only hosting and PHP-only hosting will not run the admin system.

1. Upload/extract this complete folder outside any publicly served static directory.
2. Select Node.js 24 or newer. There is no build step and no package installation is needed. Start command: `npm start`.
3. Set these environment variables in the host's settings (or copy `.env.example` to `.env` and edit it):

   ```text
   PUBLIC_ORIGIN=https://your-actual-preview-domain.example
   HOST=0.0.0.0
   PORT=8098
   DATA_DIR=/var/data/kr-solution
   ```

   Use the actual domain provided by your host. If your host injects `PORT`, keep its value instead of forcing 8098. DATA_DIR must point to a persistent disk writable by the Node process. On a VPS without a separate disk, `DATA_DIR=./private` is sufficient if that folder is preserved between releases.

4. Enable HTTPS for the domain. Forward the entire site to the running Node process, preserving the incoming Host header. The configured PUBLIC_ORIGIN makes admin login, origin validation and Secure cookies work correctly behind the HTTPS proxy. Do not expose the application under a subpath such as `/kr`; use its own domain/subdomain root.
5. If DATA_DIR is initially empty, the application imports the packaged catalogue, existing admin credential and uploads from `private/`. Existing runtime data is never overwritten by this initialization.
6. Open `https://your-domain/` and `https://your-domain/admin`.
7. Health-check path: `/healthz`.

Run exactly **one server instance/worker**. This version uses an atomic JSON file store and in-memory login sessions. It is appropriate for a single-instance client review; horizontal scaling requires a shared database/session store. Restarting the server preserves inventory but signs administrators out.

### VPS reverse-proxy example

After enabling TLS on your proxy, include this location block in the domain's HTTPS server block:

```nginx
location / {
    proxy_pass http://127.0.0.1:8098;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 8m;
}
```

For a same-machine reverse proxy, `HOST=127.0.0.1` is sufficient. A managed web-service container generally needs `HOST=0.0.0.0`. Keep the process running with your host's process manager and restart it automatically after a reboot.

### Optional Docker route

```sh
docker build -t kr-solution .
docker run -d --name kr-solution --restart unless-stopped \
  -p 127.0.0.1:8098:8098 \
  -e PUBLIC_ORIGIN=https://your-actual-preview-domain.example \
  -v kr-solution-data:/app/private \
  kr-solution
```

Point an HTTPS reverse proxy at port 8098. A new named Docker volume is initialized from the packaged private directory. Preserve the volume for future deployments. Docker configuration is provided as an option; it is not required to run the project.

## Client review checklist

- Browse Home, Products, New/Refurbished, Services, Our Story and Contact.
- Sign in at `/admin`; no admin button appears on the public website.
- Add a category, then add a product with a photograph, description, price and stock.
- Save positive stock: the item appears on the storefront.
- Save zero stock: the item disappears from cards, filters and search results.
- Restock it: the listing returns. Open storefront tabs refresh within five seconds.
- Remove and restore a product. Restored items remain unpublished until enabled.
- Test WhatsApp message preparation. An enquiry never reduces stock.
- Restart the server and verify the catalogue persists; sign in again afterward.

Run `npm test` for the automated checks. Tests use isolated temporary data, not the packaged catalogue.

## Preserve these files

- `private/catalogue.json`: current products, categories and stock.
- `private/admin.json`: administrator username and salted password hash.
- `private/uploads/`: uploaded product photographs.
- `assets/`: bundled storefront and original sample-product photos.

Back up the entire DATA_DIR before replacing a deployment. The supplied server does not serve private JSON or backend files. Do not upload the ZIP or the project root to a public file browser/static directory: the archive contains private admin data and is intended only for the hosting person.

The original catalogue uses illustrative products and pricing. The admin can replace it with the client's verified stock. Online product and office photographs used in the design preview are documented in README.md. Google Fonts is optional; system-font fallbacks are available if the network is unavailable. The storefront links to WhatsApp, Maps and the business's contact channels as expected.
