import json
import subprocess
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

def crawl_account(username, max_videos=30):
    clean = username.lstrip('@').strip()
    if not clean:
        return []
    
    url = f"https://www.tiktok.com/@{clean}"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--impersonate", "chrome:windows",
        "--flat-playlist",
        "-j",
        "--playlist-end", str(max_videos),
        url
    ]
    
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=40
        )
        videos = []
        for line in res.stdout.strip().split("\n"):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                video_id = str(data.get("id") or "").strip()
                if not video_id:
                    continue
                
                raw_date = str(data.get("upload_date") or "").strip()
                # Format YYYYMMDD -> YYYY-MM-DD
                formatted_date = None
                if len(raw_date) == 8 and raw_date.isdigit():
                    formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
                
                raw_title = str(data.get("title") or "").strip()
                if not raw_title or raw_title == "(no title)":
                    raw_title = f"TikTok Video (@{clean})"
                
                video_url = data.get("webpage_url") or data.get("url") or f"https://www.tiktok.com/@{clean}/video/{video_id}"
                
                videos.append({
                    "id": video_id,
                    "title": raw_title,
                    "link": video_url,
                    "uploadDate": formatted_date,
                    "views": int(data.get("view_count") or 0),
                    "likes": int(data.get("like_count") or 0),
                    "comments": int(data.get("comment_count") or 0),
                    "shares": int(data.get("repost_count") or data.get("save_count") or 0),
                    "username": clean
                })
            except Exception:
                continue
        return videos
    except Exception as e:
        sys.stderr.write(f"Error crawling @{clean}: {e}\n")
        return []

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_username = sys.argv[1]
        max_v = int(sys.argv[2]) if len(sys.argv) > 2 else 30
        results = crawl_account(target_username, max_v)
        print(json.dumps(results, ensure_ascii=False))
    else:
        print("[]")
