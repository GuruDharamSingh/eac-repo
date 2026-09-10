# Signal Watch

Tells you when your phone loses cell service and when it comes back. Built for a trip to Nunavut. Deliberately tiny.

Two versions live here:

| Folder | What | Use it when |
|---|---|---|
| [android/](android/) | **Native Android app** (Kotlin). Reads the phone's real signal meter, runs in the background with the screen off, persistent "No service" alert, 5-day log with calls and data use. | This is the one to install. |
| [web/](web/) | Installable web page. Works on iPhone too, but only while open on screen, and it measures data reachability rather than signal bars. | Fallback for a non-Android phone. |

See each folder's README for details.
