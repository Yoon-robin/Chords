import type { Song } from '../lib/songs';

// 인기곡은 저작권 때문에 가사 없이 구간별 코드 진행만 담았다.
// 가사가 있는 곡은 모두 저작권이 끝난 전통곡/고전곡이다.
export const BUILTIN_SONGS: Song[] = [
  {
    id: 'let-it-be',
    title: 'Let It Be',
    artist: 'The Beatles',
    key: 'C',
    bpm: 72,
    strum: '다운 4비트',
    tags: ['팝', '입문'],
    hasLyrics: false,
    body: `# Intro
| C | G | Am | F |
| C | G | F C |

# Verse
| C | G | Am | F |
| C | G | F C |
| C | G | Am | F |
| C | G | F C |

# Chorus
| Am | G | F | C |
| C | G | F C |`,
  },
  {
    id: 'knockin',
    title: "Knockin' on Heaven's Door",
    artist: 'Bob Dylan',
    key: 'G',
    bpm: 68,
    strum: '포크 스트럼',
    tags: ['포크', '입문'],
    hasLyrics: false,
    body: `# Verse
| G | D | Am | Am |
| G | D | C | C |
> 2번 반복

# Chorus
| G | D | Am | Am |
| G | D | C | C |
> 4번 반복`,
  },
  {
    id: 'stand-by-me',
    title: 'Stand By Me',
    artist: 'Ben E. King',
    key: 'A',
    bpm: 118,
    strum: '8비트',
    tags: ['올드팝', '입문'],
    hasLyrics: false,
    body: `# Intro / Verse
| A | A | F#m | F#m |
| D | E | A | A |

# Chorus
| A | A | F#m | F#m |
| D | E | A | A |`,
  },
  {
    id: 'hallelujah',
    title: 'Hallelujah',
    artist: 'Leonard Cohen',
    key: 'C',
    bpm: 56,
    time: '6/8',
    strum: '아르페지오 (6/8)',
    tags: ['발라드'],
    hasLyrics: false,
    body: `# Intro
| C | Am | C | Am |

# Verse
| C | Am | C | Am |
| F | G | C | G |
| C | F | G | Am F |
| G | E7 | Am | Am |

# Chorus
| F | Am | F | C G |
| C | C |`,
  },
  {
    id: 'wonderwall',
    title: 'Wonderwall',
    artist: 'Oasis',
    key: 'F#m',
    capo: 2,
    bpm: 87,
    strum: '16비트 스트럼',
    tags: ['브릿팝'],
    hasLyrics: false,
    body: `> 카포 2. 3·4번 손가락은 2·1번줄 3프렛에 계속 고정

# Intro / Verse
| Em7 | G | Dsus4 | A7sus4 |
> 4번 반복

# Pre-Chorus
| C | D | Em7 | Em7 |
| C | D | Em7 | Em7 |
| C | D | G | A7sus4 |

# Chorus
| C | Em7 | G | Em7 |
| C | Em7 | G | Em7 |
| C | Em7 | G | A7sus4 |`,
  },
  {
    id: 'hotel-california',
    title: 'Hotel California',
    artist: 'Eagles',
    key: 'Bm',
    bpm: 74,
    strum: '아르페지오',
    tags: ['락', '바레 연습'],
    hasLyrics: false,
    body: `> 쉬운 버전: 카포 7 + Am E G D F C Dm E 모양

# Verse
| Bm | F# | A | E |
| G | D | Em | F# |

# Chorus
| G | D | F# | Bm |
| G | D | Em | F# |`,
  },
  {
    id: 'zombie',
    title: 'Zombie',
    artist: 'The Cranberries',
    key: 'Em',
    bpm: 84,
    strum: '8비트',
    tags: ['락', '입문'],
    hasLyrics: false,
    body: `# Intro / Verse / Chorus
| Em | C | G | D |
> 곡 전체가 같은 진행 반복 (D 대신 D/F# 도 좋아요)`,
  },
  {
    id: 'creep',
    title: 'Creep',
    artist: 'Radiohead',
    key: 'G',
    bpm: 92,
    strum: '다운-업 스트럼',
    tags: ['락', '바레 연습'],
    hasLyrics: false,
    body: `# Verse / Chorus
| G | G | B | B |
| C | C | Cm | Cm |
> 곡 전체가 같은 진행 반복`,
  },
  {
    id: 'wish-you-were-here',
    title: 'Wish You Were Here',
    artist: 'Pink Floyd',
    key: 'G',
    bpm: 60,
    strum: '포크 스트럼',
    tags: ['락'],
    hasLyrics: false,
    body: `# Intro
| Em7 | G | Em7 | G |
| Em7 | A7sus4 | Em7 | A7sus4 | G |

# Verse
| C | D/F# | Am | G |
| D/F# | C | Am | G |`,
  },
  {
    id: 'country-roads',
    title: 'Take Me Home, Country Roads',
    artist: 'John Denver',
    key: 'A',
    capo: 2,
    bpm: 82,
    strum: '포크 스트럼',
    tags: ['포크', '입문'],
    hasLyrics: false,
    body: `> 카포 2, G 모양으로 연주

# Verse
| G | Em | D | C G |
| G | Em | D | C G |

# Chorus
| G | D | Em | C |
| G | D | C | G |`,
  },
  {
    id: 'wonderful-tonight',
    title: 'Wonderful Tonight',
    artist: 'Eric Clapton',
    key: 'G',
    bpm: 96,
    strum: '다운 4비트',
    tags: ['발라드', '입문'],
    hasLyrics: false,
    body: `# Intro / Verse
| G | D/F# | C | D |
| G | D/F# | C | D |

# Chorus
| C | D | G D/F# | Em |
| C | D | G | G |`,
  },
  {
    id: 'imagine',
    title: 'Imagine',
    artist: 'John Lennon',
    key: 'C',
    bpm: 76,
    strum: '다운 4비트',
    tags: ['팝', '입문'],
    hasLyrics: false,
    body: `# Verse
| C | Cmaj7 F | C | Cmaj7 F |
| C | Cmaj7 F | C | Cmaj7 F |
| F | Am Dm | F | G G7 |

# Chorus
| F | G | C | E7 |
| F | G | C | E7 |
| F | G | C | C |`,
  },

  // ---------- 저작권이 끝난 곡 (가사 포함)
  {
    id: 'arirang',
    title: '아리랑',
    artist: '민요',
    key: 'G',
    bpm: 84,
    time: '3/4',
    strum: '3박자 (쿵-짝-짝)',
    tags: ['민요', '가사', '입문'],
    hasLyrics: true,
    body: `# 1절
[G]아리랑 아리랑 [C]아라리[G]요
[G]아리랑 [Em]고개로 [D]넘어간[G]다
[G]나를 버리고 [C]가시는 [G]님은
[G]십리도 [Em]못 가서 [D]발병난[G]다`,
  },
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    artist: 'John Newton (1779)',
    key: 'G',
    bpm: 80,
    time: '3/4',
    strum: '3박자 (쿵-짝-짝)',
    tags: ['찬송가', '가사', '입문'],
    hasLyrics: true,
    body: `# Verse
A[G]mazing [G7]grace, how [C]sweet the [G]sound
That saved a wretch like [D]me
I [G]once was [G7]lost, but [C]now am [G]found
Was [Em]blind, but [D]now I [G]see`,
  },
  {
    id: 'house-rising-sun',
    title: 'House of the Rising Sun',
    artist: '미국 민요',
    key: 'Am',
    bpm: 76,
    time: '6/8',
    strum: '아르페지오 (6/8)',
    tags: ['포크', '가사'],
    hasLyrics: true,
    body: `# Verse
There [Am]is a [C]house in [D]New Or[F]leans
They [Am]call the [C]Rising [E]Sun [E]
And it's [Am]been the [C]ruin of [D]many a poor [F]boy
And [Am]God, I [E]know I'm [Am]one [E]`,
  },
  {
    id: 'scarborough-fair',
    title: 'Scarborough Fair',
    artist: '영국 민요',
    key: 'Am',
    bpm: 90,
    time: '3/4',
    strum: '아르페지오 (3/4)',
    tags: ['포크', '가사'],
    hasLyrics: true,
    body: `# Verse
[Am]Are you going to [G]Scarborough [Am]Fair?
[C]Parsley, [Am]sage, rose[D]mary and [Am]thyme
[Am]Remember [C]me to one who [G]lives there
[Am]She once [G]was a true love of [Am]mine`,
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    artist: '잉글랜드 민요',
    key: 'Am',
    bpm: 96,
    time: '3/4',
    strum: '3박자 아르페지오',
    tags: ['고전', '가사'],
    hasLyrics: true,
    body: `# Verse
A[Am]las, my [G]love, you do me [Am]wrong
To [E]cast me off dis[Am]courteously
For [Am]I have [G]loved you [Am]well and long
De[E]lighting in your [Am]company

# Chorus
[C]Greensleeves was [G]all my joy
And [Am]Greensleeves was my [E]delight
[C]Greensleeves was my [G]heart of gold
And [Am]who but my [E]lady [Am]Greensleeves`,
  },
  {
    id: 'silent-night',
    title: 'Silent Night',
    artist: 'Franz Gruber (1818)',
    key: 'C',
    bpm: 72,
    time: '3/4',
    strum: '3박자 (쿵-짝-짝)',
    tags: ['캐럴', '가사', '입문'],
    hasLyrics: true,
    body: `# Verse
[C]Silent night, holy night
[G]All is calm, [C]all is bright
[F]Round yon Virgin [C]Mother and Child
[F]Holy Infant so [C]tender and mild
[G]Sleep in heavenly [C]peace
[C]Sleep in [G]heavenly [C]peace`,
  },
  {
    id: 'oh-susanna',
    title: 'Oh! Susanna',
    artist: 'Stephen Foster (1848)',
    key: 'C',
    bpm: 112,
    strum: '컨트리 (베이스-스트럼)',
    tags: ['포크', '가사', '입문'],
    hasLyrics: true,
    body: `# Verse
I [C]come from Alabama with my [G]banjo on my knee
I'm [C]goin' to Louisiana, my [G]true love for to [C]see

# Chorus
[F]Oh! Su[F]sanna, oh [C]don't you cry for [G]me
For I [C]come from Alabama with my [G]banjo on my [C]knee`,
  },
  {
    id: 'auld-lang-syne',
    title: 'Auld Lang Syne',
    artist: 'Robert Burns (1788)',
    key: 'G',
    bpm: 80,
    strum: '다운 4비트',
    tags: ['고전', '가사'],
    hasLyrics: true,
    body: `# Verse
Should [G]auld acquaintance [D]be forgot
And [G]never brought to [C]mind?
Should [G]auld acquaintance [D]be forgot
And [Em]auld [C]lang [D]syne? [G]`,
  },
];
