# Increasing PHP upload limit (e.g. for schedule import PDF/CSV)

Schedule import allows files up to **50 MB**. PHP must allow at least that size or uploads fail with:

`The file "…" exceeds your upload_max_filesize ini directive (limit is 2048 KiB).`

## Laravel Herd (Windows)

1. **Open PHP config**
   - Run in terminal: `herd ini`
   - Or edit: `%USERPROFILE%\.config\herd\bin\php.ini`

2. **Set these (e.g. 64M for 64 MB):**
   ```ini
   upload_max_filesize = 64M
   post_max_size = 64M
   ```

3. **Restart Herd**
   - Tray icon → Stop all → Start all  
   - Or run: `herd restart`

4. **Nginx (if uploads still fail)**  
   Edit `%USERPROFILE%\.config\herd\config\nginx\herd.conf` and ensure:
   ```nginx
   client_max_body_size 64M;
   ```
   Then restart Herd.

**Large PDFs / “Maximum execution time exceeded”**  
The app raises the time limit to 120 seconds for schedule import. If you still hit a timeout (e.g. very large PDFs), in the same `php.ini` set:
```ini
max_execution_time = 120
```
Then restart Herd.

## Other setups

- **php.ini**: Set `upload_max_filesize` and `post_max_size` to at least 64M (or your desired max), then restart PHP/web server.
- **.user.ini** (if your host supports it): A `.user.ini` in `public/` is present with the same directives; not all servers read it.
