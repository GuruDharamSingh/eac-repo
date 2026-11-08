# The Hidden Enneagram: audio research

Compiled 2026-11-07 for hiddenenneagram.com (Next 16 / React 19 / Puck, public GitHub repo).
Scope: (1) scales and the enneagram, (2) sound/therapy evidence, (3) music structures for a "web of music",
(4) open-source browser code with licences, (5) background music done right, (6) design recommendations.

Evidence labels used below:
- **[primary]**: Ouspensky's text, papers, specs and official docs.
- **[secondary]**: scholarly commentary.
- **[interpretive]**: a design proposal by this report, not drawn from any tradition or clinical source.

---

## 1. Musical scales and the enneagram

### 1.1 Gurdjieff / Ouspensky: the Law of Seven and the octave  [primary]

Source: P. D. Ouspensky, *In Search of the Miraculous* (ISOTM), 1949, ch. 14, pp. 285-95. The Law of Seven is introduced in ch. 7.
Text online: https://hyperlogos.info/ouspensky/ism/c1214.htm. Reading-group transcription of pp. 288-293:
https://journalgurdjieffstudies.substack.com/p/fragments-chapter-14-pp288-293-reading

**Ch. 7, the Law of Seven.** A process develops like a major scale: do-re-mi-fa-sol-la-si-do. The two semitone places, **mi-fa** and **si-do**, are "intervals". A process cannot pass through them on its own energy and needs an outside "shock" there. Otherwise it deviates or reverses.

**Ch. 14, why there are nine elements.**
- The enneagram "expresses the law of seven in its union with the law of three".
- "The octave possesses seven tones and the eighth is a repetition of the first. Together with the two 'additional shocks' which fill the 'intervals' mi-fa and si-do, there are nine elements."
- So 7 distinct notes plus 2 shocks gives 9. The closing do coincides with the opening do at point 9.

**The 1/7 period (p. 289).**
- Dividing 1 by 7 gives 0.142857 142857 ..., which is the hexad 1-4-2-8-5-7.
- Ouspensky notes that the other sevenths (2/7 = .285714, 3/7 = .428571, ...) use the same six digits in the same cyclic order.
- He also notes: "the numbers 3, 6, and 9 are not included in the period."
- Point 9 is placed at the top, as do. "in the upper point of the triangle corresponding to do stands the number 9" (p. 288).

**Standard note-to-point placement (ISOTM p. 291 diagram).** Points go clockwise from the top. The seven notes fill the seven points that are not 3 or 6:

| Point | 9 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | (9) |
|---|---|---|---|---|---|---|---|---|---|---|
| Note | **do** | re | mi | *shock / interval* | fa | sol | *shock* | la | si | do (again) |

This matches David Seamon's Fig. 2, "The major diatonic scale placed on the enneagram":
- The top point plus the hexad's six points carry the seven notes, "completed via the second, higher do marked as point 9".
- Points 3 and 6 are marked as shocks.
- Source: Seamon, "Thinking about the Gurdjieffian Enneagram Phenomenologically", *Literature & Aesthetics* 35(2), 2025.
  https://openjournals.library.sydney.edu.au/LA/article/view/21767/18164

**The "wrong place" puzzle.**
- Point 3 sits where it belongs, between mi (2) and fa (4).
- Point 6 sits between **sol and la**, not between si and do, where the scale's second semitone actually lies.
- Ouspensky, p. 291: "The apparent placing of the interval in its wrong place itself shows to those who are able to read the symbol what kind of 'shock' is required for the passage of si to do."
- A common reading is that the shock entering at 3 starts its own octave, and that octave's mi-fa falls at point 6.
- Fuller treatments:
  - R. Defouw, *The Enneagram in the Writings of Gurdjieff* (2011), ch. 5.
  - C. Wertenbaker, *The Enneagram of G.I. Gurdjieff: Mathematics, Metaphysics, Music, and Meaning* (Codhill, 2017), ch. 8.
- Design consequence: points 3 and 6 are **events, not scale degrees**. That gives licence to sound them differently, for example unpitched or as a passing tone.

**Geometry caveat** [secondary]. The nine points are equally spaced, but tones and semitones are not. The figure is a process diagram, not a pitch-accurate dial. This is noted by Petsche, as cited in Cusack's essay: https://www.scribd.com/document/507709775/ART-CUSACK-Enneagram

**The hexad as a melody (derived, exact).** Under this placement, 1-4-2-8-5-7 reads **re-fa-mi-si-sol-la** (then back to re).
- In C it is D F E B G A, a tune that sits well in D Dorian or A minor.
- The steps in semitones are +3, -1, +7, -4, +2, then +5 back to re.

**Number facts worth knowing** (true arithmetic; how much they mean is up to the reader):
- Opposite points sum to 9 (1+8, 2+7, 3+6, 4+5). This is in ISOTM p. 287 n. 1.
- Doubling mod 9 runs 1, 2, 4, 8, 7, 5 and repeats. That is the hexad set and never touches 3, 6 or 9. Musically, doubling a frequency is the octave, so this is a cute link, but it is a mathematical curiosity, not a theory of harmony.
- Bennett and Ken Pledge note that the 3/7 relation depends on base 10. Bennett dated the figure's form to 14th-century Samarkand number theory, while Gurdjieff claimed a much older origin (see Seamon n. 10).

### 1.2 Later musical readings  [secondary]

**J. G. Bennett.**
- *Enneagram Studies* (Weiser, 1983), esp. pp. 1-5 and 16.
- *The Dramatic Universe* vol. 3 (1966), pp. 48 and 63-72. Here he reads the hexad as "progressive cyclicity".
- *Gurdjieff: Making a New World* (1973), pp. 293-97.
- Bennett treats the enneagram as a model of any self-renewing process. Octaves of activity interact at 3 and 6, where shocks from other octaves enter.
- He works with the octave conceptually and does not give a tuning system.

**A. G. E. Blake**, *The Intelligent Enneagram* (Shambhala, 1996). The most developed process and "music of events" reading in the Bennett line.

**Wertenbaker (2017).** The only book-length treatment with "Music" in its title. It covers the octave, the shock problem, and number structure. Read it before writing any explanatory copy.

**Gurdjieff / de Hartmann.**
- The piano music of 1925-27 and the music for the Movements include "Enneagram" movements danced on a nine-point floor figure.
- J. J. M. Petsche, *Gurdjieff and Music* (Brill, 2015).
- J. J. M. Petsche, "The Sacred Dance of the Enneagram", *Fieldwork in Religion* 11(1), 2016, pp. 53-75.
- An "Enneagram" piano piece credited to Gurdjieff and de Hartmann is listed at https://www.allmusic.com/search/compositions/Enneagram

**Modern compositions built on the figure:**
- **Andrius Arutiunian**, *Seven Common Ways of Disappearing* (Hallow Ground, 2023).
  - For a retuned piano and analogue electronics, with the enneagram as the score, played "Forwards" and "Backwards".
  - Grew out of the Armenia Pavilion at the 2022 Venice Biennale and draws on Gurdjieff's writing on tuning.
  - https://www.thesoundprojector.com/2023/08/20/seven-common-ways-of-disappearing/ ; https://soundohm.com/product/seven-common-ways-of-disa
- **Brian Robison**, *In Search of the Miraculous*, orchestra.
  - Premiered by the American Composers Orchestra at Carnegie Hall in 2003.
  - "mimics a journey around an enneagram": nine kinds of music enter, leave and recombine.
  - https://camd.northeastern.edu/?p=14381
- **Personality-type works.** These are listed under 2.1.

**Keep the two enneagrams apart.** The nine-*type* personality system (Ichazo, Naranjo, Riso-Hudson) has "minimal ties to the Gurdjieff tradition", per Seamon n. 7 and Cusack, *Aries* 30(1), 2020, pp. 43-51. The octave reading belongs to the Gurdjieff figure. The site uses both, so its copy should say which is in play.

### 1.3 Scale and tuning basics that matter here  [primary, standard theory]

**Diatonic vs chromatic.**
- Diatonic means 7 notes per octave with 5 whole tones and 2 semitones (the major scale is T T S T T T S). The two S are exactly mi-fa and si-do.
- Chromatic means all 12 semitones.
- The enneagram is a diatonic figure. The chromatic 12 does not divide by 9 (see 3.6).

**Modes.** The seven rotations of the diatonic scale: Ionian (do), Dorian (re), Phrygian (mi), Lydian (fa), Mixolydian (sol), Aeolian (la), Locrian (si). A starting-point selector on the figure gives the modes for free.

**Tunings.** Ratios to do and their cents:

| Note | Pythagorean (3-limit) | Just (5-limit) | 12-TET cents |
|---|---|---|---|
| do | 1/1 = 0 | 1/1 = 0 | 0 |
| re | 9/8 = 203.9 | 9/8 = 203.9 | 200 |
| mi | 81/64 = 407.8 | 5/4 = 386.3 | 400 |
| fa | 4/3 = 498.0 | 4/3 = 498.0 | 500 |
| sol | 3/2 = 702.0 | 3/2 = 702.0 | 700 |
| la | 27/16 = 905.9 | 5/3 = 884.4 | 900 |
| si | 243/128 = 1109.8 | 15/8 = 1088.3 | 1100 |
| do' | 2/1 = 1200 | 2/1 = 1200 | 1200 |

- **Pythagorean** stacks pure fifths (3:2). Twelve fifths overshoot seven octaves by the Pythagorean comma, 531441/524288 = 23.46 cents.
- **Just intonation** uses small-integer ratios, so the triads are beatless. The syntonic comma, 81/80 = 21.5 cents, is the gap between the Pythagorean and just thirds.
- **12-tone equal temperament** uses steps of 2^(1/12). Every key is equally usable and every third is slightly impure.
- **For the site:** offer a tuning switch (12-TET / just / Pythagorean). Hearing the difference at mi and la is a real teaching moment for Ario.
- Reference: W. Sethares, *Tuning, Timbre, Spectrum, Scale* (Springer, 2nd ed. 2005). It shows that consonance depends on timbre, which matters if you use unusual tunings such as 9-EDO.

**The harmonic series.**
- Partials are integer multiples f, 2f, 3f, ...
- The octave appears at 2, the fifth at 3:2, the major triad at 4:5:6, and the major second at 9:8.
- The 7th partial is 968.8 cents, 31 cents flatter than the equal-tempered minor seventh. The "seven" in nature is not a diatonic note.

**Why 7 + 2 = 9.** There are seven distinct steps; the octave do maps back onto the starting do; and there are two shocks, at mi-fa and at si-do (drawn at 6). This is Ouspensky's own count.

**The 1/7 periodic decimal.**
- 1/7 = 0.142857... has period 6 because 10 is a primitive root mod 7.
- The multiples k/7 (k = 1 to 6) are the six cyclic rotations of 142857.
- Design use: "start the hexad melody from point k" gives six rotations, the six modes of one melody (see 6.2).

---

## 2. Therapy, sound and the enneagram

### 2.1 What exists that ties sound to the enneagram types (honest inventory)

**Peer-reviewed music-therapy research on enneagram types: none found.**
- Searches for enneagram combined with music therapy, sound healing, or music preference found no journal studies.
- Personality and music research uses the Big Five, not the enneagram. For example, Rentfrow & Gosling (2003), *JPSP* 84(6), found four preference dimensions with modest trait correlations.

**Creative works (artistic, not clinical):**
- **Luis Solis**, *Energy Portraits*, SMU M.M. thesis, 2022. Nine movements, one per type: Type 3 "Flourish" is fast and syncopated, Type 5 "Delve" is a strict fugue, Type 8 "Drive" is tango in a Piazzolla style. https://scholar.smu.edu/arts_music_etds/10
- **Colton Whitted**, *Enneasongs*, West Chester U. M.M. thesis, 2021. Nine songs based on 30+ hours of interviews; the order follows the growth lines. https://digitalcommons.wcupa.edu/all_theses/224
- **Sleeping at Last** (Ryan O'Neal), *Atlas: Enneagram* (2018-19). Nine songs with a companion podcast. Popular, not research. https://integrative9.com/media/articles/40/a-homage-to-sleeping-at-last

**Practitioner offerings:**
- Enneagram-themed sound baths, podcasts and playlists, for example *The Real Enneagram* ep. 195 on sound healing and the "Enneagram music room" community.
- Coaches who hold both a music-therapy or sound-healing certificate and an enneagram certificate. These are credential pairings, not a validated method.
- Links: https://ar.player.fm/series/the-real-enneagram-a-podcast-by-the-institute-for-conscious-being/episode-195-exploring-sound-healing-with-danielle-hall-a-journey-to-wellness ; https://nobleworks.learnworlds.com/enneagram-music-room

**Weak claims often bundled in.** "432 Hz", "528 Hz solfeggio" and chakra-frequency charts rest on tiny pilots or none. Do not adopt them as type correspondences.

**The enneagram's own evidence base is mixed.**
- Hook et al., "The Enneagram: A systematic review of the literature and directions for future research", *J. Clinical Psychology* 77(4), 2021, pp. 865-883, doi:10.1002/jclp.23097. https://pubmed.ncbi.nlm.nih.gov/33332604/
- They reviewed 104 samples. Reliability and validity evidence is mixed, factor analyses usually find fewer than nine factors, and wings and lines have little support.

**Verdict.** No credible clinical literature links enneagram types to sound or music interventions. Everything on offer is artistic or devotional. Any mapping on the site must be labelled **interpretive and artistic, not therapeutic or diagnostic**. That is in fact a strength for Ario: his authorship is the point.

### 2.2 Mainstream music-therapy evidence, only as far as it informs design

**Receptive vs active** (K. Bruscia, *Defining Music Therapy*, 3rd ed., 2014).
- Receptive means listening, including Guided Imagery and Music (Bonny Method).
- Active means improvising, singing, playing or composing.
- The site can offer both: listening (background, figure playback) and doing (singing into the mic, playing the figure).

**Stress reduction.** de Witte et al. 2020, *Health Psychology Review*, doi:10.1080/17437199.2020.1846580.
- A meta-analysis of 104 RCTs of music interventions.
- Small-to-moderate effects: physiological outcomes d = .38 (heart rate d = .46), psychological outcomes d = .55.
- A companion meta-analysis of music *therapy* (47 studies) found d = .72, with larger effects in non-randomised trials.
- https://research.ou.nl/en/publications/effects-of-music-interventions-on-stress-related-outcomes-a-syste/

**Depression.** Aalbers et al. 2017, Cochrane CD004517.pub3. Music therapy added to usual care probably improves depressive symptoms short-term. Certainty is low to moderate. (Cited from memory of the review; confirm before quoting numbers.)

**Tempo and arousal.**
- Bernardi, Porta & Sleight 2006, *Heart* 92:445-452. Faster tempo raised breathing rate, heart rate and blood pressure; pauses and slow passages lowered them.
- Husain, Thompson & Schellenberg 2002, *Music Perception* 20(2). Tempo moves arousal and mode (major/minor) moves mood, largely independently.
- "Sedative" protocols in perioperative RCTs typically use 60-80 BPM, legato, low dynamic range and no strong percussion.

**Entrainment.**
- Physiological and motor systems synchronise to a steady pulse. See Clayton, Sager & Will 2005, "In time with the music", *ESEM CounterPoint* 1.
- Thaut's Rhythmic Auditory Stimulation is clinically established for gait.
- Design implication: a steady, slow, low-density pulse invites settling, while irregular or fast textures activate.

**Design translation (interpretive).** A "withdrawn" or inward lens could use:
- slower tempo (60-70 BPM or unmetred);
- softer attacks and a lower register;
- a darker filter, more reverb and lower density.

An "assertive" lens could use faster tempo, brighter timbre and percussive attack. These are general arousal levers, **not** clinical claims about types.

**Naming note.** Riso-Hudson's "Harmonic Groups" (Positive Outlook 2-7-9, Competency 1-3-5, Reactive 4-6-8) and "Hornevian groups" (Assertive 3-7-8, Compliant 1-2-6, Withdrawn 4-5-9) are metaphors. "Harmonic" here has no musical content. Source: Riso & Hudson, *The Wisdom of the Enneagram*, 1999.

---

## 3. Structures of music for a "web of music"

**Circle of fifths** (Diletskii 1679, Heinichen 1728).
- 12 pitch classes, adjacent keys share 6 of 7 notes. This is how key relationships are taught.
- Pros: everyone knows it, it is a circle like the enneagram, and the diatonic set is any 7 adjacent positions.
- Cons: 12 points, not 9.

**Tonnetz** (Euler 1739; Riemann; neo-Riemannian theory, Cohn 1998, *J. Music Theory* 42(2); *Audacious Euphony*, 2012).
- A triangular lattice with fifths on one axis and major and minor thirds on the others. Triangles are triads, and the P/L/R moves flip a triangle across an edge.
- Pros: a genuine "web". Chord progressions draw paths on it, and it is lovely animated.
- Cons: it is a torus, not a circle, and has no natural 9-fold reading.

**Chord networks / voice-leading geometry** (Tymoczko 2006, *Science* 313:72-74; *A Geometry of Music*, OUP 2011).
- Chords are points in orbifolds and smooth voice-leading is short distance.
- Pros: rigorous, and good for a force-directed graph of chords as nodes and edges weighted by voice-leading.
- Cons: abstract, and needs explaining.

**Spiral array** (Elaine Chew, MIT PhD 2000; *Mathematical and Computational Modeling of Tonality*, Springer 2014).
- Pitch classes on a helix rising a major third per quarter-turn. Chords and keys are centres of gravity inside it.
- Pros: 3D and beautiful, and it shows key-finding.
- Cons: 3D cost, and a steep learning curve for visitors.

**Interval cycles** (George Perle).
- Stepping by k semitones around 12. Steps of 1, 5, 7 and 11 visit all 12, a step of 4 gives the augmented triad, and a step of 3 gives the diminished seventh.
- On **nine** points the same logic applies: steps 1, 2, 4, 5, 7 and 8 visit all nine, while steps 3 and 6 give only the **3-6-9 triangle**.
- So the enneagram triangle is the 3-cycle of a 9-division, the analogue of the augmented triad. The hexad is *not* a step cycle; it is the 1/7 sequence. Its arc lengths are 3, 2, 3, 3, 2, 3, which is palindromic.

**Rhythm necklaces / Euclidean rhythms** (G. Toussaint, "The Euclidean Algorithm Generates Traditional Musical Rhythms", Bridges 2005, pp. 47-56: https://archive.bridgesmathart.org/2005/bridges2005-47.html).
- Spread k onsets as evenly as possible over n pulses.
- On 9 pulses:
  - **E(4,9) = x.x.x.x..** is "the Aksak rhythm of Turkey", the metre of Brubeck's *Blue Rondo a la Turk*.
  - **E(5,9) = x.x.x.x.x** is the Arab "Agsag-Samai". Started on its second onset it is a Venda drum pattern and a Romanian dance rhythm.
- These are real, cited nine-pulse rhythms that sit naturally on nine points.

### 3.6 The 12-to-9 (and 7-to-9) mapping problem: candidate layouts

| Layout | How | Pros | Cons |
|---|---|---|---|
| **A. Ouspensky diatonic** | do=9, re=1, mi=2, fa=4, sol=5, la=7, si=8; 3 and 6 are shocks | Canonical and citable; hexad = re-fa-mi-si-sol-la | Uneven pitch spacing on even geometry; 3 and 6 have no scale degree |
| **B. Shocks as passing tones** | A, plus 3 = quarter-tone between mi and fa (just midpoint 442 cents) and 6 = between sol and la (793 cents, about G#) | All nine points pitched; the "interval" is audible as in-between-ness | Invented; the quarter tone sounds "out", which may be the point |
| **C. Harmonic series 9-18** [interpretive] | point k is partial (9+k)/9, point 9 is 9 and 18 (the octave). Cents: 1 = 182, 2 = 347, 3 = 498, 4 = 637, 5 = 765, 6 = 884, 7 = 996, 8 = 1101, 9 = 1200 | Nine distinct pitches from nature; **3-6-9 = partials 12:15:18 = 4:5:6, a pure major triad**; the hexad uses 10, 13, 11, 17, 14, 16, odd "xenharmonic" partials | Not a tradition; unfamiliar to ears; needs a sine or soft timbre |
| **D. 9-EDO** (9 equal steps of 133.3 cents) | point k is k steps | Perfectly matches the geometry; the 3-6-9 triangle = 400/800/1200 cents = the 12-TET augmented triad (9 and 12 share the 3-division) | Poor fifths (667 cents); sounds alien without suitable timbres (Sethares) |
| **E. 36-gon common ring** | an outer ring of 36 ticks: every 4th is an enneagram point, every 3rd a pitch class | Shows 9 and 12 honestly side by side; good for the "web" visual | Visual only; 12 and 9 only coincide at 0, 120 and 240 degrees |
| **F. Drop or merge 3 of 12** | collapse chromatic notes onto 9 points | None worth it | Lossy and arbitrary; avoid |

**Recommendation.** Use **A** as the default, framed as Gurdjieff's own. Offer **B** and **C** as "listen differently" tuning options. Use **E** for the standalone web visual.

---

## 4. Open-source code (browser JS/TS)

Licence and activity were checked on 2026-11-07 via the GitHub and npm APIs. Sizes are min / gzip from bundlephobia.
**COPYLEFT** marks GPL, AGPL or LGPL. The site repo is public, but bundling AGPL or GPL code into the site obliges the whole combined work to follow that licence. **Avoid these unless the whole site will be licensed that way.**

### 4.1 Producing tones

| Library | Repo | Licence | Last release | Size | Good for |
|---|---|---|---|---|---|
| Web Audio API | https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API | standard | n/a | 0 | OscillatorNode, GainNode envelopes, BiquadFilter, ConvolverNode reverb, AudioWorklet; enough for sine/triangle tones and drones |
| **Tone.js** | https://github.com/Tonejs/Tone.js | MIT | 15.1.22 (Apr 2025); repo active Nov 2026 | 329 / 75 KB | Synths, Transport scheduling, sequences, effects. Lazy-load on first gesture |
| **tonal** | https://github.com/tonaljs/tonal | MIT (package.json) | 6.5.1 (Oct 2026) | 42 / 14 KB (`@tonaljs/core` 2 KB) | Notes, intervals, scales, modes, chords, keys; pure functions; no audio |
| Howler.js | https://github.com/goldfire/howler.js | MIT | 2.2.4 (Sep 2023), slow | 36 / 9.5 KB | Sound sprites, cross-browser playback; optional, since plain `<audio>` plus Web Audio covers this site |
| smplr | https://github.com/danigb/smplr | MIT | 1.2.0 (Nov 2026) | n/a | Sampled piano, soundfont and drum instruments (by tonal's author); realistic instead of synthetic tones |
| standardized-audio-context | https://github.com/chrisguttandin/standardized-audio-context | MIT | 25.3.77 | 2.9 MB unpacked | Cross-browser AudioContext shim (Tone uses it) |
| **xen-dev-utils / sonic-weave / Scale Workshop** | https://github.com/xenharmonic-devs | MIT | 2026 | small | Ratios, cents, EDOs, Scala files; microtonal and just-intonation maths for tuning switches; Scale Workshop as a reference app |
| webaudiofont | https://github.com/surikov/webaudiofont | **GPL-3.0 COPYLEFT** | active | | GM instruments; avoid |
| WebPd | https://github.com/sebpiq/WebPd | **LGPL-3.0 COPYLEFT** | active | | Pure Data patches on the web |

### 4.2 Recognising tones (mic pitch detection)

| Library | Repo | Licence | Status | Notes |
|---|---|---|---|---|
| **pitchy** | https://github.com/ianprime0509/pitchy | 0BSD (repo) / MIT (npm 4.1.0) | 4.1.0 (Jan 2024); repo active Nov 2026 | McLeod Pitch Method (McLeod & Wyvill 2005, "A Smarter Way to Find Pitch", ICMC). Returns [pitch, clarity]. 2.8 KB gz. **Best fit for monophonic voice** |
| pitchfinder | https://github.com/peterkhayes/pitchfinder | **GPL-3.0 COPYLEFT** | 2.3.4 (Dec 2025) | YIN, AMDF, dynamic wavelet, MPM; good algorithms but avoid the licence |
| CREPE | https://github.com/marl/crepe | MIT | repo 2024 | CNN pitch tracker (Kim et al., ICASSP 2018); very robust; browser port via TF.js but models are MBs |
| ml5.js 1.x | https://github.com/ml5js/ml5-next-gen | MIT | 1.4.0 (Aug 2026) | 1.x modules no longer include pitchDetection (only SoundClassifier). The old 0.x CREPE wrapper is legacy |
| aubio / aubiojs | https://github.com/aubio/aubio , https://github.com/qiuxiang/aubiojs | aubio **GPL-3.0**; the aubiojs wrapper is MIT but compiles aubio, so it is effectively **GPL** | aubiojs 2022 | Pitch, onset, tempo in WASM; avoid |
| Essentia.js | https://github.com/MTG/essentia.js | **AGPL-3.0 COPYLEFT** (commercial licence from UPF) | npm 0.1.3 (2021); repo 2025 | Huge MIR toolbox (pitch, key, BPM, mood models); 10 MB; avoid |
| basic-pitch | https://github.com/spotify/basic-pitch-ts | Apache-2.0 | 1.0.1 (2022), stale | Polyphonic audio-to-MIDI (Bittner et al., ICASSP 2022); offline and file-based, TF.js heavy; good for transcribing Ario's recordings, not live |
| Meyda | https://github.com/meyda/meyda | MIT | 5.6.3 (Apr 2024) | Not pitch: RMS, spectral centroid, chroma, MFCC; 4.9 KB gz |

### 4.3 Analysing audio

- **AnalyserNode** (https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode): `getFloatTimeDomainData` feeds pitchy, and `getByteFrequencyData` gives a spectrum.
- **AudioWorklet** (https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet): moves analysis off the main thread.
- **Meyda** (MIT): loudness and RMS for a voice meter, *chroma* for "which pitch class is sounding" (a 12-bin chromagram that maps directly to a pitch-class ring), and spectral centroid for "brightness". All are useful for driving visuals.
- Essentia.js: powerful but AGPL; see 4.2.

### 4.4 Visualising

| Library | Repo | Licence | Status | Use |
|---|---|---|---|---|
| **D3** (modules) | https://github.com/d3/d3 | ISC | 7.9.2 (Nov 2026) | `d3-force` (5.7 KB gz) for chord and type networks, `d3-shape` and `d3-scale` for rings; let React own the DOM |
| **wavesurfer.js** | https://github.com/katspaugh/wavesurfer.js | BSD-3-Clause | 8.0.5 (Nov 2026) | Waveform plus regions for Ario's tracks; 14 KB gz |
| butterchurn | https://github.com/jberg/butterchurn | MIT | npm 2.6.7 (2019); repo 2026 | MilkDrop WebGL visualiser; 42 KB gz plus presets; spectacular but generic, so use sparingly |
| audioMotion-analyzer | https://github.com/hvianna/audioMotion-analyzer | **AGPL-3.0 COPYLEFT** | 4.5.4 (Jan 2026) | Spectrum analyser; avoid. A custom canvas from AnalyserNode is about 50 lines |
| p5.sound | https://github.com/processing/p5.sound.js | **LGPL-2.1 COPYLEFT** (weak) | 0.4.1 (Jul 2026) | Tone.js wrapper for p5; brings p5; unnecessary here |
| react-circle-of-fifths | npm `react-circle-of-fifths` | MIT | 1.0.2 (2023) | Tiny SVG component; easier to write your own |
| tonnetz-viz | https://github.com/cifkao/tonnetz-viz | MIT | 2021 | MIDI-driven Tonnetz with Web Audio synth; good reference to port into React |
| Spaghetti Tonnetz | https://lorenzobrilli.github.io/spaghetti_tonnetz/src | **GPL-3.0** | | Reference only |
| z_tennot_iu | https://github.com/qwolilowp/z_tennot_iu | **LGPL-3.0** | | Reference only |

### 4.5 Live-coding / generative

- **Strudel**, a TidalCycles port in JS.
  - Development moved to Codeberg, https://codeberg.org/uzu/strudel, active Nov 2026. The GitHub mirror is archived.
  - **AGPL-3.0-or-later COPYLEFT.** That covers `@strudel/web` 1.3.0 and `@strudel/core` 1.2.6.
  - Superb for Ario as a performer, but do not bundle it. At most, link out to strudel.cc or embed it as a clearly separate iframe app, after checking the AGPL obligations.
- **Magenta.js** (`@magenta/music`), https://github.com/magenta/magenta-js.
  - Apache-2.0, but the last npm release was 1.23.1 (Nov 2021) and it is 12 MB unpacked with TF.js.
  - It offers MusicVAE and MelodyRNN continuation. It is effectively unmaintained, so use it only for an experiment.
- **For generative work, prefer** Tone.js Transport with your own rules: Euclidean rhythms, hexad rotations and a weighted random walk on the figure. This is MIT and fully under your control.

### 4.6 Recommended minimal, permissive stack

1. **Web Audio API** directly, for the figure's tones, drones and shocks. Use a wrapper only if needed.
2. **Tone.js (MIT)**, lazy-loaded via `import('tone')` inside the first click handler, for scheduling melodies and loops.
3. **tonal (MIT)** for note names, intervals, modes and chords. Add **xen-dev-utils (MIT)** for ratios and cents if you offer just or harmonic tunings.
4. **pitchy (0BSD/MIT)** plus AnalyserNode or AudioWorklet for the mic mode. Add **Meyda (MIT)** for chroma and loudness visuals if wanted.
5. **Native `<audio>`** plus the Media Session API for background music. Add **wavesurfer.js (BSD-3)** only on an "Ario's music" page.
6. **SVG in React, with d3-force / d3-shape (ISC)**, for the figure and the web visual.

Avoid: Essentia.js, audioMotion, Strudel bundling, pitchfinder, aubio(js), webaudiofont (all GPL or AGPL), and p5.sound (LGPL plus a p5 dependency).
Total added JS on first interaction is about 75 KB gz (Tone) + 14 KB (tonal) + 3 KB (pitchy) + 5 KB (Meyda). Nothing loads before the first gesture.

---

## 5. Background music on a website, done right

### 5.1 Autoplay policies: sound needs a user gesture  [primary]

**Chrome** (https://developer.chrome.com/blog/autoplay).
- Muted autoplay is always allowed.
- Autoplay *with sound* is allowed only if the user has interacted with the site, the Media Engagement Index is high (desktop), or the PWA is installed.
- An AudioContext created before a gesture starts **"suspended"**; call `ctx.resume()` from a click or keydown.

**Firefox** blocks audible autoplay by default (Firefox 66+), with per-site user overrides. `navigator.getAutoplayPolicy()` (Firefox 112+) can query the policy.
- Docs: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay

**Safari / WebKit** blocks media with sound unless it is started by a gesture (iOS 10+, macOS Safari 11+) and also restricts playback in Low Power Mode.
- https://webkit.org/blog/6784/new-video-policies-for-ios/ ; https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/
- Safari requires *transient* activation, so call `audio.play()` / `ctx.resume()` **synchronously inside the event handler**, not after an `await fetch`.

**Rule for the site:** never start sound on load. Even a returning visitor who opted in gets a one-tap "Resume Ario's music" affordance. Chrome may permit autoplay after engagement, but do not depend on it.

### 5.2 A site-wide player that persists across Next.js navigation

**Where the player lives.**
- In the App Router, **layouts are preserved across client navigation and do not re-render or re-mount** (https://nextjs.org/docs/app/getting-started/layouts-and-pages).
- Mount one `"use client"` `<AudioProvider>` plus a small `<MiniPlayer>` in `app/layout.tsx`, or in the top-level layout of the public route group.
- The `<audio>` element and the AudioContext live there, so music keeps playing through `<Link>` navigations. A hard reload, or crossing into a *different* root layout, stops it.

**State.** Use React context or a tiny store (zustand or useSyncExternalStore) exposing `play/pause/next/setVolume/duck()`. The figure components call `duck()` to lower the music by about 10-12 dB while figure tones sound, then ramp it back with `gain.setTargetAtTime`.

**Persistence.**
- Store the visitor's choice in localStorage under one versioned key, e.g. `he.audio.v1 = {consent: "on"|"off"|null, volume, muted, trackId, positionSec, updatedAt}`.
- Default to `consent: null`, which means show the opt-in pill.
- Read it in `useEffect`, not during render, to avoid hydration mismatch.
- Save the position on `pagehide` or every few seconds.

**Cross-tab.** A `BroadcastChannel("he-audio")` pauses other tabs when one starts.

**Media Session API** (https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API): title, artist (Ario) and artwork, plus lock-screen play/pause/next.

**Puck.**
- Do **not** render the player inside the Puck editor or preview iframe, or gate it to "silent preview".
- Put Ario's settings in a site-level settings record rather than per-page blocks: playlist, default volume, start mode, and per-page overrides such as "no music on this page". A Puck `root` field can carry an optional per-page override.

**Element vs Web Audio.**
- Use **HTMLAudioElement** for long tracks: it streams, honours range requests and Media Session, and uses little memory.
- Use **Web Audio** for synthesised figure sounds.
- Routing the `<audio>` through `MediaElementAudioSourceNode` (for ducking or analysis) works, but test iOS. A plain `audio.volume` fade is a fallback, and note that **iOS ignores `audio.volume`**.

### 5.3 Accessibility  [primary]

**WCAG 2.2 SC 1.4.2 Audio Control (Level A)** (https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html).
- If audio plays automatically for more than 3 seconds, there must be a way to pause or stop it, or to control its volume independently of the system.
- It is a "non-interference" criterion: failing it fails the whole page.
- With opt-in only, the site sidesteps it, but still keep a persistent, visible, keyboard-reachable pause.

**SC 1.4.7 Low or No Background Audio (AAA).** For speech content such as Ario's lessons or videos, any background bed should be at least 20 dB below the speech, or switchable off. Auto-duck the site music whenever an embedded video or voice plays.

**Controls.**
- Real `<button>`s with accessible names: "Pause Ario's music", and a mute toggle with `aria-pressed`.
- A volume slider, a visible focus ring, and a "now playing" text with `aria-live="polite"` that announces track changes only on user action.

**Screen-reader users.** Unexpected audio talks over their screen reader. This is the strongest reason for strict opt-in.

**prefers-reduced-motion** governs motion, not sound, and there is no shipped `prefers-reduced-sound` media feature. Still, a good default is: when reduced-motion is set, don't animate *and* keep figure sounds off until enabled. Offer one global "Sound: off / figure only / figure + music" setting.

### 5.4 Mobile

**iOS silent switch.**
- By default Safari treats Web Audio as "ambient", so the ring/silent switch **mutes Web Audio** (figure tones). `<audio>` element playback generally still plays.
- Since iOS 17, `navigator.audioSession.type = "playback"` makes Web Audio ignore the silent switch. Spec (Media WG draft): https://w3c.github.io/audio-session/ ; WebKit bug 237322: https://bugs.webkit.org/show_bug.cgi?id=237322
- Set it on the opt-in gesture. The old looping-silent-`<audio>` hack works but shows lock-screen controls.

**Unlock gesture.** In the first tap handler, create or resume the AudioContext and play a zero-gain one-sample buffer. Do it synchronously.

**Backgrounding.** iOS and Android may suspend audio when the tab is hidden. Listen to `visibilitychange` and `ctx.onstatechange`, and resume on the next tap.

**Data.** Use `preload="none"` (or `"metadata"`) and start loading only on opt-in.

### 5.5 Formats, streaming and loudness

**Formats.**
- Ship **AAC-LC in .m4a (128-160 kbps)** or **MP3 (128-192 kbps)** as the universal baseline.
- Optionally add Opus (WebM/Ogg) at about 96 kbps as a first `<source>`. Check Safari support per version at https://caniuse.com/opus.
- For seamless loops of figure drones, prefer short WAV/Opus decoded into an AudioBuffer, because MP3 encoder padding breaks gapless loops.

**Range requests.** Servers must answer `Range:` with **206 Partial Content** and `Accept-Ranges: bytes`. Safari will not play media otherwise, and seeking needs it.
- Next's `public/`, Vercel and most CDNs do this. A custom route handler or a Nextcloud share must be tested with `curl -I -H "Range: bytes=0-1"`.

**Loudness.**
- Master or normalise the files consistently, measured in integrated LUFS (EBU R128 / ITU-R BS.1770), with a true peak of -1 dBTP or lower.
- -16 LUFS is the common web and podcast target. Apple Podcasts recommends -16 LKFS: https://podcasters.apple.com/support/893-audio-requirements
- AES TD1008 (2021) is the current streaming recommendation. It sets a speech/music midpoint around -17/-18 LUFS; verify against the PDF before quoting. Summaries: https://productionadvice.co.uk/td1008/ ; https://www.grimmaudio.com/news/aes-td1008-ends-the-loudness-war/
- For a *background* bed, also start the player at about 0.4-0.5 volume or master beds near -20 to -23 LUFS, so the site never startles.

### 5.6 Music licensing

- Ario's own compositions and recordings are fine. He holds the rights.
  - If any are registered with a PRO or distributor such as PRS, ASCAP or DistroKid, check that self-hosting on his own site is permitted (it normally is).
  - Note co-writer and performer splits.
- **Third-party music**, including covers, Gurdjieff/de Hartmann recordings, samples and stock beds, needs explicit licences. Note:
  - Recordings and editions of the Gurdjieff/de Hartmann piano music remain in copyright.
  - A cover needs a mechanical/sync licence.
  - "Royalty-free" stock licences often exclude background use on commercial sites or require attribution.
- Keep a `credits.json` per track (title, composer, performer, licence, source URL) and render it on a credits page.
- Generated tones (oscillators) carry no licence issues. Sampled instruments do: check the sample-library licence, e.g. smplr's soundfonts.

---

## 6. Design recommendations for the site

### 6.1 "The Octave on the Figure" (core feature)

**Mapping.** Use Ouspensky's placement (do 9, re 1, mi 2, fa 4, sol 5, la 7, si 8) with **do = a gentle low drone at point 9** that sustains whenever sound is on.

**Interaction.**
- Hover or tap a point to sound its note: a soft sine/triangle with a 20-40 ms attack and 1-2 s release.
- "Walk the circle" plays 9 → 1 → 2 → [3] → 4 → 5 → [6] → 7 → 8 → 9 at about 60-72 BPM, so visitors *hear* the scale and the two shocks.
- Copy for 3 and 6: "the interval; a shock from outside the octave". Quote ISOTM p. 291 on the "wrong place".

**Shocks (3 and 6).** Make them **unpitched and different in kind**: a struck bowl or bell, a short filtered-noise "breath", or a momentary change in the drone. This dramatises "an outside force". An alternative toggle uses layout B (quarter-tone passing pitches).

**Tuning switch.** 12-TET / Just / Pythagorean / "Harmonic 9-18". Show cents beside each point, so the mi and la differences are visible as well as audible. This is educator gold.

**Mode selector.** "Start the octave from point k" rotates the mode (re = Dorian, and so on).

### 6.2 "The Hexad Line" and "The Triangle"

**1-4-2-8-5-7 as a melody** (re-fa-mi-si-sol-la). The line animates as it plays, then loops. Offer three things:
1. A **"seven sevenths"** control. 1/7 to 6/7 start the same digit cycle from a different point. Show the decimal 0.142857 → 0.285714 ... as the line lights up, giving six rotations of one tune.
2. **Rhythm**: play the hexad over **E(4,9) aksak** or **E(5,9) agsag-samai** on a nine-pulse cycle, one pulse per point (Toussaint 2005).
3. **Tempo / feel** governed by the active lens (6.3).

**3-6-9 triangle as a chord.**
- In 12-TET with the Ouspensky mapping it has no fixed pitches, so voice it as the shock sounds struck together.
- In the **Harmonic 9-18** tuning it is exactly **4:5:6, a pure major triad**: "the law of three as consonance".
- In 9-EDO it is an augmented triad.
- Let visitors compare the three, and label the comparison as interpretive.

### 6.3 Centres and lenses change the sound  [interpretive; label it on the page]

**Centres → register and colour.**

| Centre | Points | Register | Colour |
|---|---|---|---|
| Gut | 8-9-1 | low | felt-drum attack |
| Heart | 2-3-4 | middle | voice-like (formant filter) |
| Head | 5-6-7 | high | bell or glass partials |

The drone at 9 belongs to the gut and anchors everything.

**Lenses → global parameters.**
- Ario authors a small table per lens: tempo, attack, filter cutoff, reverb, density, mode.
- Example: a withdrawn/inward lens has slower tempo, a darker filter, more space and sparser notes. An assertive lens is brighter, faster and more percussive.
- Use general arousal findings (tempo, density and attack raise arousal; slow, legato and soft settle) as rough guides only. **No therapeutic claims** (see 2.1).
- Store the table in Puck or site settings so Ario can tune it himself, and morph between lenses with 1-2 s parameter ramps rather than cuts.

### 6.4 "Sing a tone and see where it lands" (mic mode)

**Flow.**
1. Explicit button: "Use my microphone".
2. Request `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}})`. Turn off the voice-processing defaults, which distort pitch.
3. Feed an AnalyserNode (fftSize 2048-4096) or an AudioWorklet into **pitchy**. Accept only frames with clarity > 0.9 and RMS above a floor.

**Display.**
- A glowing marker travels on the figure to the nearest note's point, with a cents needle showing sharp or flat.
- Pitch is folded to the octave relative to a user-chosen do. Let the visitor first sing their comfortable "do", which sets point 9.
- Optional "hold for 2 s to sound the point" game. Optional drone-reference practice for Ario's students: match re, then the hexad melody.

**Chroma variant.** Meyda chroma, folded to 12 pitch classes, can light the 36-gon ring of 6.5 for chords or instruments.

**Privacy.** Processing is 100% local; nothing is recorded or uploaded. Say so beside the button, and stop all tracks when the mode closes.

### 6.5 Standalone "Web of Music" visual

**A layered, zoomable SVG/canvas page:**
- **Outer ring**: a 36-gon. Every 3rd tick is a pitch class in circle-of-fifths order, every 4th tick an enneagram point. Coincidences at 0, 120 and 240 degrees are highlighted. This is the honest 12-meets-9 picture.
- **Middle**: the enneagram (circle, triangle, hexad) with a selectable note mapping (A/B/C/D from 3.6).
- **Inner**: an interval-cycle explorer. Pick a step k and watch the path. On 9, steps 3 and 6 give the triangle; on 12, 4 gives the augmented triad and 7 visits every key.
- **Side panel or second mode**: a Tonnetz (port the MIT tonnetz-viz idea to React) or a d3-force chord network. Ario's own pieces can be loaded as MIDI or tonal symbols and drawn as paths across it.
- **Rhythm layer**: Euclidean necklaces E(k,9) on the nine points, beside E(k,12) on the twelve.

Everything sounds when touched and is silent until the first gesture.

### 6.6 Ario's background-music player

**Behaviour.**
- A layout-level client island persists across navigation (5.2).
- Opt-in pill: "Play Ario's music". Remembered in localStorage, but each new session still needs one tap to resume.
- Visible pause, mute and volume controls. Media Session metadata. Auto-ducking under figure sounds and any speech or video.
- No player inside Puck preview.

**Ario's controls** (site settings): playlist order, per-track credits, default volume, crossfade length, and per-page "music off / specific track".

**Files.** Use AAC/MP3 masters normalised to a consistent LUFS (bed level around -20), served with range requests, `preload="none"`.

**Good touch.** Offer an optional "tune the figure to the music". Ario tags each track with its key or tonic, and the figure's do drone and notes transpose to match, so playing the figure over his music stays consonant. Tonal handles the transposition.
