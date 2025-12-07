curl --location 'https://open.tiktokapis.com/v2/post/publish/content/init/' \
--header 'Authorization: Bearer act.E69lOAe5qqowcEkdovcZ5J94ftwzqq9HXP79THdlES6zPuvYVG3O6QRsVe58!6424.u1' \
--header 'Content-Type: application/json' \
--data-raw '{
    "post_info": {
        "title": "funny cat",
        "description": "this will be a #funny photo on your @tiktok #fyp",
        "disable_comment": true,
        "privacy_level": "SELF_ONLY",
        "auto_add_music": true
    },
    "source_info": {
        "source": "PULL_FROM_URL",
        "photo_cover_index": 1,
        "photo_images": [
            "https://tiktokcdn.com/obj/example-image-01.webp",
            "https://tiktokcdn.com/obj/example-image-02.webp"
        ]
    },
    "post_mode": "MEDIA_UPLOAD",
    "media_type": "PHOTO"
}'