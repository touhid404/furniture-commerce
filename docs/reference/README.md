# Reference capture index

The source video is retained locally at the project root. It is 23.474 seconds long and encoded at 720 by 1280 pixels. The embedded desktop website is approximately x 0 to 720 and y 438 to 843.

Local captures are `home.png` at 0 seconds, `catalog.png` at 4 seconds, `sign-in.png` at 10 seconds and `admin-overview.png` at 18 seconds. The local `frames` folder contains 47 captures sampled every half second with a timestamp manifest. These images and the source video are intentionally ignored by Git per the owner's instruction; the timestamped textual design specification is the shared evidence index.

`docs/internal/extract_video.swift` recreates the captures on macOS using AVFoundation. Preview sheets and document render images are also local-only. No image is required to run documentation checks in a fresh GitHub checkout.
