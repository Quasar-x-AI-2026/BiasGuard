import yt_dlp

urls = [
    "https://youtu.be/svrCf6QrDmU",
    'https://youtu.be/Kk9ENdehGSU',
    'https://youtu.be/YKlsBJY5SgU',
    'https://youtu.be/Nu3knhYOCsU',
    'https://youtu.be/rkV8WeVwVA4',
    ]

ydl_opts = {
    "format": "best",
    "outtmpl": "sampled_videos/%(title)s.%(ext)s"
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(urls)