import os
import requests
import threading
import urllib.parse
from pipeline.utils.logger import get_logger

log = get_logger("indexer")

def _encode_flash_slug(flash_id: int, title: str, published_at: str) -> str:
    import re
    slug = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u00c0-\u024f\s]', ' ', title)
    slug = '-'.join(slug.strip().split())
    slug = slug.lower()[:60].rstrip('-')
    if slug:
        return f"{slug}-{flash_id}"
    
    dt_str = published_at.replace(' ', 'T') + 'Z'
    cleaned = re.sub(r'[-T:Z.\s]', '', dt_str)
    yyyymmddhh = cleaned[:10]
    padded_id = f"{flash_id:04d}"
    return f"{yyyymmddhh}{padded_id}"

def _do_indexnow_ping(full_urls):
    key = "REDACTED"
    host = "yayanews.cryptooptiontool.com"
    payload = {
        "host": host,
        "key": key,
        "keyLocation": f"https://{host}/{key}.txt",
        "urlList": full_urls
    }
    try:
        resp = requests.post("https://www.bing.com/indexnow", json=payload, timeout=5)
        resp.raise_for_status()
        log.info(f"Pinged IndexNow successfully: {len(full_urls)} URLs")
    except Exception as e:
        log.warning(f"Failed to ping IndexNow API: {e}")

def _do_ping(urls):
    webhook_url = os.environ.get("INDEXING_WEBHOOK_URL", "http://localhost:3000/api/webhooks/indexing")
    secret = os.environ.get("INDEXING_WEBHOOK_SECRET", "ya29.secret.fallback.123")
    try:
        resp = requests.post(
            webhook_url,
            json={"urls": urls},
            headers={"Authorization": f"Bearer {secret}"},
            timeout=5
        )
        resp.raise_for_status()
        log.info(f"Pinged Indexer successfully: {len(urls)} URLs")
    except Exception as e:
        log.warning(f"Failed to ping indexer webhook: {e}")

def ping_indexer(article_slug=None, flash_dict=None):
    urls_google = []
    urls_all_paths = []
    
    if article_slug:
        urls_all_paths.append(f"/zh/article/{urllib.parse.quote(article_slug)}")
        urls_all_paths.append(f"/en/article/{urllib.parse.quote(article_slug)}")
        urls_google.extend(urls_all_paths)
        
    if flash_dict:
        flash_slug = _encode_flash_slug(flash_dict["id"], flash_dict["title"], flash_dict["published_at"])
        flash_paths = [
            f"/zh/flash/{urllib.parse.quote(flash_slug)}",
            f"/en/flash/{urllib.parse.quote(flash_slug)}"
        ]
        urls_all_paths.extend(flash_paths)
        
        importance = flash_dict.get("importance", "normal")
        if importance in ["high", "urgent"]:
            urls_google.extend(flash_paths)
        else:
            log.info(f"Skipping Google ping for normal flash: {flash_dict['id']}")
        
    if urls_google:
        threading.Thread(target=_do_ping, args=(urls_google,), daemon=True).start()
        
    if urls_all_paths:
        base_url = "https://yayanews.cryptooptiontool.com"
        full_urls = [f"{base_url}{p}" for p in urls_all_paths]
        threading.Thread(target=_do_indexnow_ping, args=(full_urls,), daemon=True).start()
