# API Payload Examples

## Text Message
```json
{
    "messages": [
        {
            "id": "AC4FC6AC688E3B47A3DF519F8428045E",
            "phone_number_id": "919201954770",
            "from": "919981114545",
            "text": {
                "body": "Test 1"
            },
            "type": "text"
        }
    ]
}
```

## Image Message
```json
{
    "messages": [
        {
            "id": "B5F2C7DB799F4C58B4E1629A9539156F",
            "phone_number_id": "919201954770",
            "from": "919981114545",
            "image": "http://localhost:3000/multimedia/d24f2099-8c69-49fd-9564-81d3577d61ad_1703259123456_a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
            "text": {
                "body": "Check out this image"
            },
            "type": "image"
        }
    ]
}
```

## Notes

- The `image` attribute contains the full public URL to access the downloaded image
- Images are stored in the `multimedia/` folder with the format: `{sessionId}_{timestamp}_{uuid}.{ext}`
- The caption (if any) is included in the `text.body` field
- Set the `BASE_URL` environment variable for production deployment to use your domain instead of localhost
