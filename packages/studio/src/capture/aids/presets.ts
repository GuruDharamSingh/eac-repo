// Generated from preset-looks/data/core36.json + video.json (the 12 core video shapes). Data only.
// Regenerate in the preset-looks folder; do not hand-edit.
import type { CapturePreset } from './types';

export const CAPTURE_PRESETS: CapturePreset[] = [
  {
    "id": "V1",
    "name": "Three-second glimpse",
    "effect": "tease",
    "shots": [
      {
        "id": "s1",
        "say": "one slow pan across an edge",
        "by": "aid",
        "engine": "capture",
        "seconds": 3,
        "aid": [
          {
            "kind": "frame",
            "shape": "close-up"
          },
          {
            "kind": "timer",
            "seconds": 3
          }
        ],
        "camera": {
          "lens": "close",
          "height": "table",
          "move": "pan R",
          "light": "low side light skimming the edge"
        }
      },
      {
        "id": "s2",
        "say": "trim to 3 s, then black",
        "by": "machine",
        "engine": "ffmpeg"
      }
    ]
  },
  {
    "id": "V2",
    "name": "Sound before picture",
    "effect": "tease",
    "shots": [
      {
        "id": "s1",
        "say": "5 s black with studio sound",
        "by": "human",
        "engine": "capture",
        "seconds": 5,
        "aid": [],
        "camera": {
          "lens": "normal",
          "height": "low",
          "move": "locked",
          "light": "near-dark room, one lamp ready to switch on"
        }
      },
      {
        "id": "s2",
        "say": "1 s flash of the piece",
        "by": "aid",
        "engine": "capture",
        "seconds": 1,
        "aid": [
          {
            "kind": "frame",
            "shape": "centre-box"
          },
          {
            "kind": "mark",
            "name": "flash"
          }
        ],
        "mark": "flash",
        "camera": {
          "lens": "close",
          "height": "low",
          "move": "locked",
          "light": "one warm lamp, dark surround"
        }
      },
      {
        "id": "s3",
        "say": "hold black under the sound, cut in on the flash",
        "by": "machine",
        "engine": "ffmpeg"
      }
    ]
  },
  {
    "id": "V27",
    "name": "Cover drop",
    "effect": "reveal",
    "shots": [
      {
        "id": "s1",
        "say": "covered piece",
        "by": "aid",
        "engine": "capture",
        "seconds": 2,
        "aid": [
          {
            "kind": "frame",
            "shape": "centre-box"
          }
        ],
        "camera": {
          "lens": "wide",
          "height": "low",
          "move": "locked",
          "light": "soft overcast window light, shadows long and quiet"
        }
      },
      {
        "id": "s2",
        "say": "hand on cloth",
        "by": "human",
        "engine": "capture",
        "seconds": 1,
        "aid": [],
        "camera": {
          "lens": "wide",
          "height": "low",
          "move": "locked",
          "light": "soft overcast window light, shadows long and quiet"
        }
      },
      {
        "id": "s3",
        "say": "lift on the beat",
        "by": "aid",
        "engine": "capture",
        "seconds": 1,
        "aid": [
          {
            "kind": "beat",
            "bpm": 90,
            "count": 4
          },
          {
            "kind": "mark",
            "name": "lift"
          }
        ],
        "mark": "lift",
        "camera": {
          "lens": "wide",
          "height": "low",
          "move": "locked",
          "light": "soft overcast window light, shadows long and quiet"
        }
      },
      {
        "id": "s4",
        "say": "piece",
        "by": "human",
        "engine": "capture",
        "seconds": 3,
        "aid": [],
        "camera": {
          "lens": "wide",
          "height": "low",
          "move": "locked",
          "light": "soft overcast window light, shadows long and quiet"
        }
      },
      {
        "id": "s5",
        "say": "title and music hit on the lift mark",
        "by": "machine",
        "engine": "remotion"
      }
    ]
  },
  {
    "id": "V70",
    "name": "Seats left",
    "effect": "hype",
    "shots": [
      {
        "id": "s1",
        "say": "empty chairs",
        "by": "aid",
        "engine": "capture",
        "seconds": 4,
        "aid": [
          {
            "kind": "frame",
            "shape": "horizon"
          }
        ],
        "camera": {
          "lens": "wide",
          "height": "low",
          "move": "locked",
          "light": "soft overcast window light, shadows long and quiet"
        }
      },
      {
        "id": "s2",
        "say": "number left on screen",
        "by": "machine",
        "engine": "overlay",
        "seconds": 3
      }
    ]
  },
  {
    "id": "V13",
    "name": "Time-lapse",
    "effect": "continuing",
    "shots": [
      {
        "id": "s1",
        "say": "hours of work, locked camera",
        "by": "aid",
        "engine": "capture",
        "aid": [
          {
            "kind": "frame",
            "shape": "centre-box"
          },
          {
            "kind": "ghost"
          }
        ],
        "camera": {
          "lens": "wide",
          "height": "table",
          "move": "locked",
          "light": "soft overcast window light, tidy surface"
        }
      },
      {
        "id": "s2",
        "say": "compress hours into 20 s",
        "by": "machine",
        "engine": "ffmpeg",
        "seconds": 20
      }
    ]
  },
  {
    "id": "V24",
    "name": "ASMR sounds",
    "effect": "buffer",
    "shots": [
      {
        "id": "s1",
        "say": "carving",
        "by": "aid",
        "engine": "capture",
        "seconds": 5,
        "aid": [
          {
            "kind": "frame",
            "shape": "close-up"
          }
        ],
        "camera": {
          "lens": "macro",
          "height": "table",
          "move": "locked",
          "light": "low raking side light to bring out texture"
        }
      },
      {
        "id": "s2",
        "say": "pouring",
        "by": "aid",
        "engine": "capture",
        "seconds": 5,
        "aid": [
          {
            "kind": "frame",
            "shape": "close-up"
          }
        ],
        "camera": {
          "lens": "macro",
          "height": "table",
          "move": "locked",
          "light": "low raking side light to bring out texture"
        }
      },
      {
        "id": "s3",
        "say": "brushing",
        "by": "aid",
        "engine": "capture",
        "seconds": 5,
        "aid": [
          {
            "kind": "frame",
            "shape": "close-up"
          }
        ],
        "camera": {
          "lens": "macro",
          "height": "table",
          "move": "locked",
          "light": "low raking side light to bring out texture"
        }
      },
      {
        "id": "s4",
        "say": "level the sound, no music",
        "by": "machine",
        "engine": "ffmpeg"
      }
    ]
  },
  {
    "id": "V49",
    "name": "Letter to",
    "effect": "sad",
    "shots": [
      {
        "id": "s1",
        "say": "slow b-roll",
        "by": "aid",
        "engine": "capture",
        "seconds": 20,
        "aid": [
          {
            "kind": "frame",
            "shape": "thirds"
          },
          {
            "kind": "prompt",
            "text": "Dear"
          }
        ],
        "mark": "tc"
      },
      {
        "id": "s2",
        "say": "voice reads 'Dear …'",
        "by": "human",
        "engine": "capture",
        "seconds": 20,
        "aid": [
          {
            "kind": "prompt",
            "text": "Dear"
          }
        ]
      },
      {
        "id": "s3",
        "say": "subtitles",
        "by": "machine",
        "engine": "whisper"
      }
    ]
  },
  {
    "id": "V18",
    "name": "Mistake and fix",
    "effect": "sad",
    "shots": [
      {
        "id": "s1",
        "say": "it goes wrong",
        "by": "aid",
        "engine": "capture",
        "seconds": 4,
        "aid": [
          {
            "kind": "frame",
            "shape": "centre-box"
          },
          {
            "kind": "mark",
            "name": "mistake"
          }
        ],
        "mark": "mistake",
        "camera": {
          "lens": "close",
          "height": "table",
          "move": "locked",
          "light": "north window light from the side, soft falloff"
        }
      },
      {
        "id": "s2",
        "say": "pause",
        "by": "human",
        "engine": "capture",
        "seconds": 2,
        "aid": [],
        "camera": {
          "lens": "close",
          "height": "table",
          "move": "locked",
          "light": "north window light from the side, soft falloff"
        }
      },
      {
        "id": "s3",
        "say": "the fix",
        "by": "human",
        "engine": "capture",
        "seconds": 5,
        "aid": [],
        "camera": {
          "lens": "close",
          "height": "table",
          "move": "locked",
          "light": "north window light from the side, soft falloff"
        }
      },
      {
        "id": "s4",
        "say": "result",
        "by": "aid",
        "engine": "capture",
        "seconds": 3,
        "aid": [
          {
            "kind": "frame",
            "shape": "centre-box"
          }
        ],
        "camera": {
          "lens": "close",
          "height": "table",
          "move": "locked",
          "light": "north window light from the side, soft falloff"
        }
      },
      {
        "id": "s5",
        "say": "caption on the mistake mark",
        "by": "machine",
        "engine": "remotion"
      }
    ]
  },
  {
    "id": "V81",
    "name": "Episode opener",
    "effect": "continuing",
    "shots": [
      {
        "id": "s1",
        "say": "the series sting",
        "by": "machine",
        "engine": "remotion",
        "seconds": 3
      },
      {
        "id": "s2",
        "say": "'episode 4'",
        "by": "machine",
        "engine": "remotion",
        "seconds": 2
      },
      {
        "id": "s3",
        "say": "straight in",
        "by": "human",
        "engine": "capture",
        "aid": []
      }
    ]
  },
  {
    "id": "V89",
    "name": "From the archive",
    "effect": "callback",
    "shots": [
      {
        "id": "s1",
        "say": "old clip with its year",
        "by": "machine",
        "engine": "ffmpeg",
        "seconds": 6
      },
      {
        "id": "s2",
        "say": "today's note",
        "by": "aid",
        "engine": "capture",
        "seconds": 6,
        "aid": [
          {
            "kind": "frame",
            "shape": "face-line"
          },
          {
            "kind": "prompt",
            "text": "today's"
          }
        ],
        "mark": "on"
      },
      {
        "id": "s3",
        "say": "year stamp and film grain",
        "by": "machine",
        "engine": "remotion"
      }
    ]
  },
  {
    "id": "V43",
    "name": "Answer a comment",
    "effect": "continuing",
    "shots": [
      {
        "id": "s1",
        "say": "comment on screen",
        "by": "machine",
        "engine": "remotion",
        "seconds": 3
      },
      {
        "id": "s2",
        "say": "maker answers",
        "by": "aid",
        "engine": "capture",
        "seconds": 20,
        "aid": [
          {
            "kind": "frame",
            "shape": "face-line"
          },
          {
            "kind": "prompt",
            "text": "the"
          }
        ],
        "mark": "being"
      },
      {
        "id": "s3",
        "say": "subtitles",
        "by": "machine",
        "engine": "whisper"
      }
    ]
  },
  {
    "id": "V52",
    "name": "Stitch",
    "effect": "continuing",
    "shots": [
      {
        "id": "s1",
        "say": "their opening line",
        "by": "machine",
        "engine": "ffmpeg",
        "seconds": 3
      },
      {
        "id": "s2",
        "say": "cut",
        "by": "machine",
        "engine": "ffmpeg"
      },
      {
        "id": "s3",
        "say": "maker answers or continues",
        "by": "aid",
        "engine": "capture",
        "seconds": 15,
        "aid": [
          {
            "kind": "frame",
            "shape": "face-line"
          },
          {
            "kind": "prompt",
            "text": "their"
          }
        ],
        "mark": "for"
      }
    ]
  }
] as CapturePreset[];

export const capturePreset = (id: string | null | undefined): CapturePreset | null =>
  CAPTURE_PRESETS.find((p) => p.id === String(id ?? '').toUpperCase()) ?? null;
